import { CallCommand } from '../../src/commands/call'
import * as configModule from '../../src/config'
import * as clientModule from '../../src/api/client'
import { OvrmndError, ErrorCode } from '../../src/utils/error'
import type { ResolvedServiceConfig } from '../../src/types/config'

// Mock dependencies
jest.mock('../../src/config')
jest.mock('../../src/api/client')

const mockLoadServiceConfig =
  configModule.loadServiceConfig as jest.MockedFunction<
    typeof configModule.loadServiceConfig
  >
const mockCallEndpoint =
  clientModule.callEndpoint as jest.MockedFunction<
    typeof clientModule.callEndpoint
  >

// Mock console methods
const mockConsoleError = jest
  .spyOn(console, 'error')
  .mockImplementation()
// Mock process.stdout.write
const mockStdoutWrite = jest
  .spyOn(process.stdout, 'write')
  .mockImplementation(() => true)
// Mock process.exit to prevent actual exit
const mockProcessExit = jest
  .spyOn(process, 'exit')
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit(${code})`)
  })

describe('CallCommand', () => {
  const command = new CallCommand()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  const mockConfig: ResolvedServiceConfig = {
    serviceName: 'testservice',
    baseUrl: 'https://api.test.com',
    endpoints: [
      {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
      },
      {
        name: 'createUser',
        method: 'POST',
        path: '/users',
      },
    ],
    aliases: [
      {
        name: 'me',
        endpoint: 'getUser',
        args: { id: 'current' },
      },
    ],
  }

  describe('handler', () => {
    it('should handle invalid target format', async () => {
      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'invalidformat',
          params: [],
          pretty: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid target format 'invalidformat'",
        ),
      )
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })

    it('should call an endpoint successfully and output JSON by default', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: true,
        data: { id: 123, name: 'Test User' },
      })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        params: ['id=123'],
        pretty: false,
        debug: false,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      expect(mockLoadServiceConfig).toHaveBeenCalledWith(
        'testservice',
      )
      expect(mockCallEndpoint).toHaveBeenCalledWith(
        mockConfig,
        mockConfig.endpoints[0],
        {
          path: { id: '123' },
          query: {},
          headers: {},
        },
      )
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        JSON.stringify({ id: 123, name: 'Test User' }, null, 2) +
          '\n',
      )
    })

    it('should handle pretty output mode', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: true,
        data: { id: 123, name: 'Test User' },
      })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        params: ['id=123'],
        pretty: true,
        debug: false,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      // In pretty mode, it should not output raw JSON
      expect(mockStdoutWrite).not.toHaveBeenCalledWith(
        JSON.stringify({ id: 123, name: 'Test User' }, null, 2) +
          '\n',
      )
      // But should still output something
      expect(mockStdoutWrite).toHaveBeenCalled()
    })

    it('should handle aliases', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: true,
        data: { id: 'current', name: 'Current User' },
      })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.me',
        params: [],
        pretty: true,
        debug: false,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      expect(mockCallEndpoint).toHaveBeenCalledWith(
        mockConfig,
        mockConfig.endpoints[0],
        {
          path: { id: 'current' },
          query: {},
          body: undefined,
        },
      )
    })

    it('should handle parameter hints', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'New User' },
      })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.createUser',
        params: [],
        pretty: true,
        debug: false,
        path: [],
        query: ['limit=10'],
        header: ['X-API-Version=v2'],
        body: ['name=New User', 'email=new@test.com'],
      })

      expect(mockCallEndpoint).toHaveBeenCalledWith(
        mockConfig,
        mockConfig.endpoints[1],
        {
          path: {},
          query: { limit: '10' },
          headers: { 'X-API-Version': 'v2' },
          body: { name: 'New User', email: 'new@test.com' },
        },
      )
    })

    it('should handle service not found', async () => {
      mockLoadServiceConfig.mockRejectedValue(
        new OvrmndError({
          code: ErrorCode.SERVICE_NOT_FOUND,
          message:
            "Service 'nonexistent' not found. Run 'ovrmnd list services' to see available services.",
        }),
      )

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'nonexistent.test',
          params: [],
          pretty: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Service 'nonexistent' not found"),
      )
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })

    it('should handle endpoint not found', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.nonexistent',
          params: [],
          pretty: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Endpoint or alias 'nonexistent' not found in service 'testservice'",
        ),
      )
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })

    it('should handle API errors', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Internal server error',
          details: { status: 500 },
        },
      })

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          params: ['id=123'],
          pretty: true,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      // Error output goes to stderr, not stdout
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Internal server error'),
      )
      expect(mockProcessExit).toHaveBeenCalledWith(1)
    })

    it('should show debug information when debug flag is set', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
      mockCallEndpoint.mockResolvedValue({
        success: true,
        data: { id: 123 },
      })

      const stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation()

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        params: ['id=123'],
        pretty: true,
        debug: true,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      // Check that debug formatter was used
      expect(mockLoadServiceConfig).toHaveBeenCalledWith(
        'testservice',
        expect.objectContaining({ isEnabled: true }),
      )
      expect(mockCallEndpoint).toHaveBeenCalledWith(
        mockConfig,
        mockConfig.endpoints[0],
        expect.any(Object),
        expect.objectContaining({ isEnabled: true }),
      )

      // Verify debug output
      const stderrOutput = stderrSpy.mock.calls
        .map(call => call[0])
        .join('')
      expect(stderrOutput).toContain('[DEBUG]')
      expect(stderrOutput).toContain('[PARAMS]')

      stderrSpy.mockRestore()
    })
  })

  describe('parseKeyValueArray', () => {
    it('should parse key=value pairs', () => {
      const result = command['parseKeyValueArray']([
        'name=John',
        'age=30',
        'city=New York',
      ])

      expect(result).toEqual({
        name: 'John',
        age: '30',
        city: 'New York',
      })
    })

    it('should handle values with equals signs', () => {
      const result = command['parseKeyValueArray']([
        'equation=a=b+c',
        'url=https://example.com?foo=bar',
      ])

      expect(result).toEqual({
        equation: 'a=b+c',
        url: 'https://example.com?foo=bar',
      })
    })

    it('should ignore invalid entries', () => {
      const result = command['parseKeyValueArray']([
        'valid=yes',
        'invalid',
        '=nokey',
        'another=valid',
      ])

      expect(result).toEqual({
        valid: 'yes',
        another: 'valid',
      })
    })

    it('should handle empty array', () => {
      const result = command['parseKeyValueArray']([])
      expect(result).toEqual({})
    })
  })

  describe('batch operations', () => {
    beforeEach(() => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)
    })

    it('should execute batch operations successfully', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ])

      mockCallEndpoint
        .mockResolvedValueOnce({
          success: true,
          data: { id: 1, name: 'User 1' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 2, name: 'User 2' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 3, name: 'User 3' },
        })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        batchJson,
        pretty: false,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      expect(mockCallEndpoint).toHaveBeenCalledTimes(3)
      expect(mockCallEndpoint).toHaveBeenNthCalledWith(
        1,
        mockConfig,
        mockConfig.endpoints[0],
        expect.objectContaining({
          path: { id: '1' },
        }),
        expect.any(Object),
      )

      const output = mockStdoutWrite.mock.calls[0]?.[0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toHaveLength(3)
      expect(parsed[0]).toEqual({
        success: true,
        data: { id: 1, name: 'User 1' },
      })
      expect(parsed[1]).toEqual({
        success: true,
        data: { id: 2, name: 'User 2' },
      })
      expect(parsed[2]).toEqual({
        success: true,
        data: { id: 3, name: 'User 3' },
      })
    })

    it('should handle mixed success and failure in batch', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '999' }, // This will fail
        { id: '3' },
      ])

      mockCallEndpoint
        .mockResolvedValueOnce({
          success: true,
          data: { id: 1, name: 'User 1' },
        })
        .mockResolvedValueOnce({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 3, name: 'User 3' },
        })

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockCallEndpoint).toHaveBeenCalledTimes(3)

      const output = mockStdoutWrite.mock.calls[0]?.[0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toHaveLength(3)
      expect(parsed[0]).toEqual({
        success: true,
        data: { id: 1, name: 'User 1' },
      })
      expect(parsed[1]).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      expect(parsed[2]).toEqual({
        success: true,
        data: { id: 3, name: 'User 3' },
      })
    })

    it('should stop on first error with fail-fast mode', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '999' }, // This will fail
        { id: '3' }, // This should not be called
      ])

      mockCallEndpoint
        .mockResolvedValueOnce({
          success: true,
          data: { id: 1, name: 'User 1' },
        })
        .mockResolvedValueOnce({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        })

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson,
          failFast: true,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      // Should only call twice, not three times
      expect(mockCallEndpoint).toHaveBeenCalledTimes(2)

      const output = mockStdoutWrite.mock.calls[0]?.[0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toHaveLength(2) // Only 2 results, not 3
    })

    it('should merge CLI parameters with batch parameters', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '2', includeDetails: true },
      ])

      mockCallEndpoint
        .mockResolvedValueOnce({ success: true, data: { id: 1 } })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 2, details: {} },
        })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        batchJson,
        pretty: false,
        path: [],
        query: ['format=json'], // This should apply to all requests
        header: [],
        body: [],
      })

      expect(mockCallEndpoint).toHaveBeenCalledTimes(2)

      // Check that CLI params were merged
      expect(mockCallEndpoint).toHaveBeenNthCalledWith(
        1,
        mockConfig,
        mockConfig.endpoints[0],
        expect.objectContaining({
          path: { id: '1' },
          query: { format: 'json' },
        }),
        expect.any(Object),
      )

      expect(mockCallEndpoint).toHaveBeenNthCalledWith(
        2,
        mockConfig,
        mockConfig.endpoints[0],
        expect.objectContaining({
          path: { id: '2' },
          query: { format: 'json', includeDetails: 'true' },
        }),
        expect.any(Object),
      )
    })

    it('should format batch results in pretty mode', async () => {
      const batchJson = JSON.stringify([{ id: '1' }, { id: '999' }])

      mockCallEndpoint
        .mockResolvedValueOnce({
          success: true,
          data: { id: 1, name: 'User 1' },
        })
        .mockResolvedValueOnce({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        })

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson,
          pretty: true,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      const output = mockStdoutWrite.mock.calls
        .map(call => call[0])
        .join('')

      // Check for formatted output
      expect(output).toContain('=== Request 1/2 ===')
      expect(output).toContain('✓ Success')
      expect(output).toContain('User 1')
      expect(output).toContain('=== Request 2/2 ===')
      expect(output).toContain('✗ Failed')
      expect(output).toContain('User not found')
      expect(output).toContain('Summary: 1 succeeded, 1 failed')
    })

    it('should reject invalid batch JSON', async () => {
      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson: 'not valid json',
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid batch JSON format'),
      )
    })

    it('should reject non-array batch JSON', async () => {
      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson: '{"id": "1"}', // Object, not array
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid batch JSON format'),
      )
    })

    it('should reject empty batch array', async () => {
      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.getUser',
          batchJson: '[]',
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit(1)')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Batch JSON array is empty'),
      )
    })

    it('should show progress in debug mode', async () => {
      const batchJson = JSON.stringify([{ id: '1' }, { id: '2' }])
      const stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation()

      mockCallEndpoint
        .mockResolvedValueOnce({ success: true, data: { id: 1 } })
        .mockResolvedValueOnce({ success: true, data: { id: 2 } })

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        batchJson,
        pretty: false,
        debug: true,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      const stderrOutput = stderrSpy.mock.calls
        .map(call => call[0])
        .join('')
      expect(stderrOutput).toContain(
        'Starting batch operation with 2 requests',
      )
      expect(stderrOutput).toContain('Executing request 1 of 2...')
      expect(stderrOutput).toContain('Executing request 2 of 2...')

      stderrSpy.mockRestore()
    })
  })

  describe('convertToRawParams', () => {
    it('should convert valid values to RawParams', () => {
      const result = command['convertToRawParams']({
        string: 'test',
        number: 42,
        boolean: true,
        array: ['a', 'b'],
        null: null,
        undefined: undefined,
        object: { nested: 'value' },
      })

      expect(result).toEqual({
        string: 'test',
        number: 42,
        boolean: true,
        array: ['a', 'b'],
        object: '[object Object]',
      })
    })
  })

  describe('mergeParams', () => {
    it('should merge multiple param sets with correct precedence', () => {
      const params1 = { a: 'first', b: 'first', c: 'first' }
      const params2 = { b: 'second', c: 'second', d: 'second' }
      const params3 = { c: 'third', e: 'third' }

      const result = command['mergeParams'](
        params1 as any,
        params2 as any,
        params3 as any,
      )

      expect(result).toEqual({
        a: 'first',
        b: 'second',
        c: 'third',
        d: 'second',
        e: 'third',
      })
    })
  })
})
