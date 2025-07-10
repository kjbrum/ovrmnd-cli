import { InitCommand } from '../../src/commands/init'
import * as fs from 'fs/promises'
import * as yaml from 'js-yaml'
import prompts from 'prompts'
import { OutputFormatter } from '../../src/utils/output'
import { ErrorCode } from '../../src/utils/error'
import { AIConfigGenerator } from '../../src/services/ai-config-generator'

jest.mock('fs/promises')
jest.mock('prompts')
jest.mock('../../src/utils/output')
jest.mock('../../src/services/ai-config-generator')

describe('InitCommand', () => {
  let command: InitCommand
  let mockFs: jest.Mocked<typeof fs>
  let mockPrompts: jest.MockedFunction<typeof prompts>
  let mockFormatter: jest.Mocked<OutputFormatter>
  let processStdoutSpy: jest.SpyInstance
  let processStderrSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()

    command = new InitCommand()
    mockFs = fs as jest.Mocked<typeof fs>
    mockPrompts = prompts as jest.MockedFunction<typeof prompts>

    mockFormatter = {
      isJsonMode: true,
      format: jest
        .fn()
        .mockImplementation(data => JSON.stringify(data)),
      formatError: jest.fn().mockImplementation(error => {
        if (mockFormatter.isJsonMode && error instanceof Error) {
          return JSON.stringify({
            error: error.message,
            code: (error as any).code,
          })
        }
        return `Error: ${error}`
      }),
      success: jest.fn().mockImplementation(msg => `✓ ${msg}`),
      warning: jest.fn().mockImplementation(msg => `⚠ ${msg}`),
      info: jest.fn().mockImplementation(msg => `ℹ ${msg}`),
      error: jest.fn().mockImplementation(msg => `✗ ${msg}`),
      code: jest.fn().mockImplementation(text => text),
      highlight: jest.fn().mockImplementation(text => text),
    } as unknown as jest.Mocked<OutputFormatter>
    ;(
      OutputFormatter as jest.MockedClass<typeof OutputFormatter>
    ).mockImplementation(() => mockFormatter)

    processStdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation()
    processStderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation()
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    // Mock file system methods
    mockFs.access.mockRejectedValue(new Error('File not found'))
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('builder', () => {
    it('should configure command correctly', () => {
      const yargs = {
        positional: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        example: jest.fn().mockReturnThis(),
      }

      const result = command.builder(yargs as any)

      expect(yargs.positional).toHaveBeenCalledWith('serviceName', {
        describe: 'Service name (lowercase, no spaces)',
        type: 'string',
      })

      expect(yargs.option).toHaveBeenCalledWith(
        'template',
        expect.objectContaining({
          alias: 't',
          describe: 'Template to use',
          type: 'string',
          choices: ['rest'],
          default: 'rest',
        }),
      )

      expect(yargs.option).toHaveBeenCalledWith(
        'output',
        expect.objectContaining({
          alias: 'o',
          describe: 'Output file path',
          type: 'string',
        }),
      )

      expect(yargs.option).toHaveBeenCalledWith(
        'force',
        expect.objectContaining({
          alias: 'f',
          describe: 'Overwrite existing file',
          type: 'boolean',
          default: false,
        }),
      )

      expect(yargs.option).toHaveBeenCalledWith(
        'interactive',
        expect.objectContaining({
          alias: 'i',
          describe: 'Use interactive mode for configuration',
          type: 'boolean',
          default: false,
        }),
      )

      expect(result).toBe(yargs)
    })
  })

  describe('handler', () => {
    describe('JSON mode', () => {
      beforeEach(() => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          get: jest.fn(() => true),
          configurable: true,
        })
      })

      it('should create config file with provided service name', async () => {
        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'myapi',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(mockFs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('.ovrmnd'),
          { recursive: true },
        )

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('myapi.yaml'),
          expect.stringContaining('serviceName: myapi'),
          'utf-8',
        )

        const output = JSON.parse(
          processStdoutSpy.mock.calls[0][0] as string,
        )
        expect(output.success).toBe(true)
        expect(output.service).toBe('myapi')
        expect(output.path).toContain('myapi.yaml')
      })

      it('should fail if service name not provided in JSON mode', async () => {
        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(processExitSpy).toHaveBeenCalledWith(1)
        expect(mockFormatter.formatError).toHaveBeenCalled()
        const errorCall = (mockFormatter.formatError as jest.Mock)
          .mock.calls[0][0]
        expect(errorCall.code).toBe(ErrorCode.PARAM_REQUIRED)
      })

      it('should fail if file exists and force is false', async () => {
        mockFs.access.mockResolvedValueOnce(undefined) // File exists

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'existing',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(processExitSpy).toHaveBeenCalledWith(1)
        const output = JSON.parse(
          processStdoutSpy.mock.calls[0][0] as string,
        )
        expect(output.success).toBe(false)
        expect(output.error).toBe('File already exists')
      })

      it('should overwrite file if force is true', async () => {
        mockFs.access.mockResolvedValueOnce(undefined) // File exists

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'existing',
          template: 'rest',
          force: true,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(mockFs.writeFile).toHaveBeenCalled()
        const output = JSON.parse(
          processStdoutSpy.mock.calls[0][0] as string,
        )
        expect(output.success).toBe(true)
      })

      it('should create file in global directory if global flag is set', async () => {
        const originalHome = process.env['HOME']
        process.env['HOME'] = '/home/user'

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'globalapi',
          template: 'rest',
          force: false,
          global: true,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(mockFs.mkdir).toHaveBeenCalledWith(
          '/home/user/.ovrmnd',
          { recursive: true },
        )

        expect(mockFs.writeFile).toHaveBeenCalled()
        const writeCall = mockFs.writeFile.mock.calls[0]
        expect(writeCall?.[0]).toBe(
          '/home/user/.ovrmnd/globalapi.yaml',
        )
        expect(writeCall?.[2]).toBe('utf-8')

        process.env['HOME'] = originalHome
      })
    })

    describe('Interactive mode', () => {
      beforeEach(() => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          get: jest.fn(() => false),
          configurable: true,
        })
      })

      it('should prompt for service info when not provided', async () => {
        mockPrompts.mockResolvedValueOnce({
          serviceName: 'interactive',
          displayName: 'Interactive API',
          baseUrl: 'https://api.interactive.com',
          authType: 'bearer',
        })

        mockPrompts.mockResolvedValueOnce({
          envVarName: 'INTERACTIVE_API_TOKEN',
        })

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          template: 'rest',
          force: false,
          global: false,
          interactive: true,
          pretty: true,
          debug: false,
        })

        expect(mockPrompts).toHaveBeenCalledTimes(2)
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('interactive.yaml'),
          expect.stringContaining('serviceName: interactive'),
          'utf-8',
        )
      })

      it('should prompt for overwrite if file exists', async () => {
        mockFs.access.mockResolvedValueOnce(undefined) // File exists

        // Mock the service info prompts (display name, baseUrl, authType)
        mockPrompts.mockResolvedValueOnce({
          displayName: 'Existing API',
          baseUrl: 'https://api.existing.com',
          authType: 'bearer',
        })

        // Mock the auth prompts
        mockPrompts.mockResolvedValueOnce({
          envVarName: 'EXISTING_API_TOKEN',
        })

        // Then mock the overwrite prompt
        mockPrompts.mockResolvedValueOnce({ confirm: true })

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'existing',
          template: 'rest',
          force: false,
          global: false,
          interactive: true,
          pretty: true,
          debug: false,
        })

        expect(mockPrompts).toHaveBeenCalledTimes(3)
        const lastCall = mockPrompts.mock.calls[2]?.[0]
        expect(lastCall).toEqual(
          expect.objectContaining({
            type: 'confirm',
            message: expect.stringContaining('already exists'),
          }),
        )

        expect(mockFs.writeFile).toHaveBeenCalled()
      })

      it('should cancel if user declines overwrite', async () => {
        mockFs.access.mockResolvedValueOnce(undefined) // File exists

        // Mock the service info prompts (display name, baseUrl, authType)
        mockPrompts.mockResolvedValueOnce({
          displayName: 'Existing API',
          baseUrl: 'https://api.existing.com',
          authType: 'bearer',
        })

        // Mock the auth prompts
        mockPrompts.mockResolvedValueOnce({
          envVarName: 'EXISTING_API_TOKEN',
        })

        // Then mock the overwrite prompt
        mockPrompts.mockResolvedValueOnce({ confirm: false })

        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'existing',
          template: 'rest',
          force: false,
          global: false,
          interactive: true,
          pretty: true,
          debug: false,
        })

        expect(mockFs.writeFile).not.toHaveBeenCalled()
        expect(mockFormatter.warning).toHaveBeenCalledWith(
          'Init cancelled',
        )
        expect(processStderrSpy).toHaveBeenCalled()
      })
    })

    describe('Template generation', () => {
      it('should generate REST template with correct structure', async () => {
        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'restapi',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(mockFs.writeFile).toHaveBeenCalled()
        const yamlContent = mockFs.writeFile.mock
          .calls[0]?.[1] as string
        if (!yamlContent) {
          throw new Error('No YAML content written')
        }
        const config = yaml.load(
          yamlContent
            .split('\n')
            .filter(line => !line.startsWith('#'))
            .join('\n'),
        ) as any

        expect(config.serviceName).toBe('restapi')
        expect(config.baseUrl).toBe('https://api.restapi.com/v1')
        expect(config.authentication.type).toBe('bearer')
        expect(config.endpoints).toHaveLength(5)
        expect(config.endpoints[0].name).toBe('list')
        expect(config.endpoints[0].method).toBe('GET')
        expect(config.endpoints[0].transform).toBeDefined()
        expect(config.aliases).toHaveLength(1)
      })

      it('should handle custom output path', async () => {
        await command.handler({
          _: ['init'],
          $0: 'ovrmnd',
          serviceName: 'custom',
          template: 'rest',
          output: '/custom/path/custom.yml',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
        })

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          '/custom/path/custom.yml',
          expect.any(String),
          'utf-8',
        )
      })
    })

    describe('AI-powered generation', () => {
      let mockAIGenerator: jest.Mocked<AIConfigGenerator>

      beforeEach(() => {
        mockAIGenerator = {
          generateConfig: jest.fn(),
        } as unknown as jest.Mocked<AIConfigGenerator>
        ;(
          AIConfigGenerator as jest.MockedClass<
            typeof AIConfigGenerator
          >
        ).mockImplementation(() => mockAIGenerator)
      })

      it('should require service name when using --prompt', async () => {
        await command.handler({
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
          prompt: 'Create GitHub API config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '"error":"Service name is required when using --prompt"',
          ),
        )
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should generate config using AI when prompt is provided', async () => {
        const mockAIConfig = {
          serviceName: 'github',
          baseUrl: 'https://api.github.com',
          authentication: {
            type: 'bearer' as const,
            token: '${GITHUB_TOKEN}',
          },
          endpoints: [
            {
              name: 'listRepos',
              method: 'GET' as const,
              path: '/user/repos',
              cacheTTL: 300,
            },
          ],
          aliases: [
            {
              name: 'my-repos',
              endpoint: 'listRepos',
              args: { type: 'owner' },
            },
          ],
        }

        mockAIGenerator.generateConfig.mockResolvedValue(mockAIConfig)
        mockFs.access.mockRejectedValue(new Error('File not found'))
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.writeFile.mockResolvedValue(undefined)

        await command.handler({
          serviceName: 'github',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
          prompt:
            'Create GitHub API config for repository management',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(mockAIGenerator.generateConfig).toHaveBeenCalledWith(
          'github',
          'Create GitHub API config for repository management',
        )

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('github.yaml'),
          expect.stringContaining('github API Configuration'),
          'utf-8',
        )

        expect(processStdoutSpy).toHaveBeenCalledWith(
          expect.stringContaining('"success":true'),
        )
      })

      it('should show progress message in pretty mode', async () => {
        const mockAIConfig = {
          serviceName: 'test',
          baseUrl: 'https://api.test.com',
          endpoints: [],
        }

        mockAIGenerator.generateConfig.mockResolvedValue(mockAIConfig)
        mockFs.access.mockRejectedValue(new Error('File not found'))
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.writeFile.mockResolvedValue(undefined)

        await command.handler({
          serviceName: 'test',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: true,
          debug: false,
          prompt: 'Create test API config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(mockFormatter.info).toHaveBeenCalledWith(
          '🤖 Using AI to research and generate configuration...\n',
        )
      })

      it('should extract environment variable from AI config', async () => {
        const mockAIConfig = {
          serviceName: 'slack',
          baseUrl: 'https://slack.com/api',
          authentication: {
            type: 'apikey' as const,
            token: '${SLACK_API_KEY}',
            header: 'Authorization',
          },
          endpoints: [],
        }

        mockAIGenerator.generateConfig.mockResolvedValue(mockAIConfig)
        mockFs.access.mockRejectedValue(new Error('File not found'))
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.writeFile.mockResolvedValue(undefined)

        await command.handler({
          serviceName: 'slack',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
          prompt: 'Create Slack API config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '"Set environment variable: SLACK_API_KEY"',
          ),
        )
      })

      it('should handle AI generation errors gracefully', async () => {
        mockAIGenerator.generateConfig.mockRejectedValue(
          new Error('AI generation failed'),
        )

        await command.handler({
          serviceName: 'test',
          template: 'rest',
          force: false,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
          prompt: 'Create test config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(mockFormatter.formatError).toHaveBeenCalled()
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should respect --force flag with AI generation', async () => {
        const mockAIConfig = {
          serviceName: 'test',
          baseUrl: 'https://api.test.com',
          endpoints: [],
        }

        mockAIGenerator.generateConfig.mockResolvedValue(mockAIConfig)
        mockFs.access.mockResolvedValue(undefined) // File exists
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.writeFile.mockResolvedValue(undefined)

        await command.handler({
          serviceName: 'test',
          template: 'rest',
          force: true,
          global: false,
          interactive: false,
          pretty: false,
          debug: false,
          prompt: 'Create test config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(mockFs.writeFile).toHaveBeenCalled()
        expect(processStdoutSpy).toHaveBeenCalledWith(
          expect.stringContaining('"success":true'),
        )
      })

      it('should respect --global flag with AI generation', async () => {
        const mockAIConfig = {
          serviceName: 'test',
          baseUrl: 'https://api.test.com',
          endpoints: [],
        }

        mockAIGenerator.generateConfig.mockResolvedValue(mockAIConfig)
        mockFs.access.mockRejectedValue(new Error('File not found'))
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.writeFile.mockResolvedValue(undefined)

        await command.handler({
          serviceName: 'test',
          template: 'rest',
          force: false,
          global: true,
          interactive: false,
          pretty: false,
          debug: false,
          prompt: 'Create test config',
          _: [],
          $0: 'ovrmnd',
        } as any)

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringMatching(/\.ovrmnd\/test\.yaml$/),
          expect.any(String),
          'utf-8',
        )
      })
    })
  })
})
