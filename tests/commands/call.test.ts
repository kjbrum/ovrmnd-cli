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
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
const mockConsoleError = jest
  .spyOn(console, 'error')
  .mockImplementation()
const mockProcessExit = jest
  .spyOn(process, 'exit')
  .mockImplementation(() => {
    throw new Error('process.exit called')
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
          json: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit called')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid target format 'invalidformat'",
        ),
      )
    })

    it('should call an endpoint successfully', async () => {
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
        json: false,
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
          body: undefined,
        },
      )
      expect(mockConsoleLog).toHaveBeenCalled()
    })

    it('should handle JSON output mode', async () => {
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
        json: true,
        debug: false,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify({ id: 123, name: 'Test User' }, null, 2),
      )
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
        json: false,
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
        json: false,
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
          json: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit called')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Service 'nonexistent' not found"),
      )
    })

    it('should handle endpoint not found', async () => {
      mockLoadServiceConfig.mockResolvedValue(mockConfig)

      await expect(
        command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'testservice.nonexistent',
          params: [],
          json: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit called')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Endpoint or alias 'nonexistent' not found in service 'testservice'",
        ),
      )
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
          json: false,
          debug: false,
          path: [],
          query: [],
          header: [],
          body: [],
        }),
      ).rejects.toThrow('process.exit called')

      expect(mockConsoleLog).toHaveBeenCalledWith(
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

      const mockDebug = jest.spyOn(command['logger'], 'debug')

      await command.handler({
        _: [],
        $0: 'ovrmnd',
        target: 'testservice.getUser',
        params: ['id=123'],
        json: false,
        debug: true,
        path: [],
        query: [],
        header: [],
        body: [],
      })

      expect(mockDebug).toHaveBeenCalledWith('Calling endpoint', {
        service: 'testservice',
        endpoint: 'getUser',
        alias: undefined,
        mappedParams: expect.any(Object),
      })
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
})
