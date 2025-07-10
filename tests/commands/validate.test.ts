import { ValidateCommand } from '../../src/commands/validate'
import { ConfigValidator } from '../../src/config/config-validator'
import { OutputFormatter } from '../../src/utils/output'
import * as fs from 'fs/promises'
import type { ValidationResult } from '../../src/commands/validate'

jest.mock('../../src/config/config-validator')
jest.mock('../../src/utils/output')
jest.mock('fs/promises')
jest.mock('../../src/config/discovery', () => ({
  getGlobalConfigDir: jest
    .fn()
    .mockReturnValue('/mocked/global/.ovrmnd'),
  getLocalConfigDir: jest
    .fn()
    .mockReturnValue('/mocked/local/.ovrmnd'),
}))

describe('ValidateCommand', () => {
  let command: ValidateCommand
  let mockValidator: jest.Mocked<ConfigValidator>
  let mockFormatter: jest.Mocked<OutputFormatter>
  let processExitSpy: jest.SpyInstance
  let processStdoutSpy: jest.SpyInstance
  let processStderrSpy: jest.SpyInstance

  const mockValidationResults: ValidationResult[] = [
    {
      file: '/path/to/valid.yaml',
      valid: true,
      errors: [],
      warnings: [],
    },
    {
      file: '/path/to/warnings.yaml',
      valid: true,
      errors: [],
      warnings: [
        {
          message: 'Test warning',
          suggestion: 'Fix this',
        },
      ],
    },
    {
      file: '/path/to/errors.yaml',
      valid: false,
      errors: [
        {
          message: 'Test error',
          line: 10,
          context: 'some context',
        },
      ],
      warnings: [],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock ConfigValidator
    mockValidator = {
      validateFile: jest.fn(),
      validateFiles: jest.fn(),
    } as any
    ;(
      ConfigValidator as jest.MockedClass<typeof ConfigValidator>
    ).mockImplementation(() => mockValidator)

    // Mock OutputFormatter
    mockFormatter = {
      isJsonMode: false,
      formatError: jest
        .fn()
        .mockImplementation((msg: string) => `ERROR: ${msg}`),
      warning: jest
        .fn()
        .mockImplementation((msg: string) => `WARNING: ${msg}`),
      success: jest
        .fn()
        .mockImplementation((msg: string) => `SUCCESS: ${msg}`),
      table: jest.fn().mockImplementation(() => 'TABLE'),
      dim: jest
        .fn()
        .mockImplementation((msg: string) => `DIM: ${msg}`),
    } as any
    ;(
      OutputFormatter as jest.MockedClass<typeof OutputFormatter>
    ).mockImplementation(() => mockFormatter)

    // Mock fs.promises
    ;(
      fs.readdir as jest.MockedFunction<typeof fs.readdir>
    ).mockResolvedValue([
      'service1.yaml',
      'service2.yml',
      'README.md',
    ] as any)
    ;(
      fs.readFile as jest.MockedFunction<typeof fs.readFile>
    ).mockResolvedValue('serviceName: test\n')

    command = new ValidateCommand()
    jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('process.exit')
      })
    processStdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation()
    processStderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('command structure', () => {
    it('should have correct command string', () => {
      expect(command.command).toBe('validate [service]')
    })

    it('should have correct description', () => {
      expect(command.describe).toBe(
        'Validate service configuration files',
      )
    })
  })

  describe('builder', () => {
    it('should configure yargs correctly', () => {
      const yargs = {
        positional: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        example: jest.fn().mockReturnThis(),
      }

      command.builder(yargs as any)

      expect(yargs.positional).toHaveBeenCalledWith('service', {
        describe:
          'Service name to validate (validates all if omitted)',
        type: 'string',
      })

      expect(yargs.option).toHaveBeenCalledWith('file', {
        alias: 'f',
        describe: 'Validate a specific file',
        type: 'string',
      })

      expect(yargs.option).toHaveBeenCalledWith('strict', {
        describe: 'Treat warnings as errors',
        type: 'boolean',
        default: false,
      })
    })
  })

  describe('handler', () => {
    describe('validate all files', () => {
      it('should validate all discovered YAML files', async () => {
        // Use only results without errors for this test
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[0]!,
          mockValidationResults[1]!,
        ])

        await command.handler({
          pretty: true,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(mockValidator.validateFiles).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('service1.yaml'),
            expect.stringContaining('service2.yml'),
          ]),
        )

        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'SUCCESS: ✓ /path/to/valid.yaml: Valid',
          ),
        )
      })

      it('should output JSON when not in pretty mode', async () => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          value: true,
          writable: true,
          configurable: true,
        })
        // Use only results without errors for this test
        const resultsWithoutErrors = [
          mockValidationResults[0]!,
          mockValidationResults[1]!,
        ]
        mockValidator.validateFiles.mockResolvedValue(
          resultsWithoutErrors,
        )

        await command.handler({
          pretty: false,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            JSON.stringify({ results: resultsWithoutErrors }),
          ),
        )
      })
    })

    describe('validate specific service', () => {
      it('should filter and validate files for specific service', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[0]!,
        ])
        ;(
          fs.readFile as jest.MockedFunction<typeof fs.readFile>
        ).mockImplementation(path => {
          if (path.toString().includes('service1.yaml')) {
            return Promise.resolve('serviceName: service1\n')
          }
          return Promise.resolve('serviceName: other\n')
        })

        await command.handler({
          service: 'service1',
          pretty: true,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(mockValidator.validateFiles).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('service1.yaml'),
          ]),
        )
      })

      it('should error when service not found', async () => {
        await expect(
          command.handler({
            service: 'nonexistent',
            pretty: true,
            _: ['validate'],
            $0: 'ovrmnd',
          } as any),
        ).rejects.toThrow('process.exit')

        expect(mockFormatter.formatError).toHaveBeenCalled()
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })

    describe('validate specific file', () => {
      it('should validate a specific file', async () => {
        mockValidator.validateFile.mockResolvedValue(
          mockValidationResults[0]!,
        )

        await command.handler({
          file: '/path/to/config.yaml',
          pretty: true,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(mockValidator.validateFile).toHaveBeenCalledWith(
          '/path/to/config.yaml',
        )
        expect(mockValidator.validateFiles).not.toHaveBeenCalled()
      })
    })

    describe('error handling', () => {
      it('should exit with code 1 when validation has errors', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[2]!,
        ])

        await expect(
          command.handler({
            pretty: true,
            _: ['validate'],
            $0: 'ovrmnd',
          } as any),
        ).rejects.toThrow('process.exit')

        expect(processExitSpy).toHaveBeenCalledWith(1)
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('✖ Validation failed'),
        )
      })

      it('should exit with code 1 in strict mode when warnings exist', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[1]!,
        ])

        await expect(
          command.handler({
            pretty: true,
            strict: true,
            _: ['validate'],
            $0: 'ovrmnd',
          } as any),
        ).rejects.toThrow('process.exit')

        expect(processExitSpy).toHaveBeenCalledWith(1)
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '✖ Validation failed (strict mode)',
          ),
        )
      })

      it('should pass when no errors and not strict', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[1]!,
        ])

        await command.handler({
          pretty: true,
          strict: false,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(processExitSpy).not.toHaveBeenCalled()
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ Validation passed'),
        )
      })
    })

    describe('output formatting', () => {
      it('should display errors with line numbers and context', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[2]!,
        ])

        await expect(
          command.handler({
            pretty: true,
            _: ['validate'],
            $0: 'ovrmnd',
          } as any),
        ).rejects.toThrow('process.exit')

        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('ERROR: ✖ Error: Test error'),
        )
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Line 10: some context'),
        )
      })

      it('should display warnings with suggestions', async () => {
        mockValidator.validateFiles.mockResolvedValue([
          mockValidationResults[1]!,
        ])

        await command.handler({
          pretty: true,
          _: ['validate'],
          $0: 'ovrmnd',
        } as any)

        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠ Warning: Test warning'),
        )
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Suggestion: Fix this'),
        )
      })

      it('should display summary table', async () => {
        mockValidator.validateFiles.mockResolvedValue(
          mockValidationResults,
        )

        await expect(
          command.handler({
            pretty: true,
            _: ['validate'],
            $0: 'ovrmnd',
          } as any),
        ).rejects.toThrow('process.exit')

        expect(mockFormatter.table).toHaveBeenCalledWith(
          ['Summary'],
          [],
        )
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Files validated: 3'),
        )
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Errors: 1'),
        )
        expect(processStderrSpy).toHaveBeenCalledWith(
          expect.stringContaining('Warnings: 1'),
        )
      })
    })
  })
})
