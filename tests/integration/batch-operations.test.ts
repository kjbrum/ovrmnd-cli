import { CallCommand } from '../../src/commands/call'
import * as configModule from '../../src/config'
import type { ResolvedServiceConfig } from '../../src/types/config'

// Create a mock service config for testing
const createMockConfig = (
  serviceName = 'test-api',
): ResolvedServiceConfig => ({
  serviceName,
  baseUrl: 'https://jsonplaceholder.typicode.com',
  endpoints: [
    {
      name: 'getUser',
      method: 'GET',
      path: '/users/{id}',
    },
    {
      name: 'listUsers',
      method: 'GET',
      path: '/users',
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
      args: { id: '1' },
    },
  ],
})

describe('Batch Operations Integration Tests', () => {
  let stdoutOutput: string[] = []
  let stderrOutput: string[] = []
  let exitCode: number | undefined

  // Mock process.stdout.write and process.stderr.write
  const originalStdoutWrite = process.stdout.write
  const originalStderrWrite = process.stderr.write
  const originalExit = process.exit

  beforeEach(() => {
    stdoutOutput = []
    stderrOutput = []
    exitCode = undefined

    process.stdout.write = jest.fn((chunk: string | Uint8Array) => {
      stdoutOutput.push(chunk.toString())
      return true
    }) as any

    process.stderr.write = jest.fn((chunk: string | Uint8Array) => {
      stderrOutput.push(chunk.toString())
      return true
    }) as any

    process.exit = jest.fn((code?: number) => {
      exitCode = code
      throw new Error(`process.exit(${code})`)
    }) as any
  })

  afterEach(() => {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
    process.exit = originalExit
    jest.clearAllMocks()
  })

  describe('CallCommand batch operations', () => {
    const command = new CallCommand()

    beforeEach(() => {
      // Mock config loading
      jest
        .spyOn(configModule, 'loadServiceConfig')
        .mockResolvedValue(createMockConfig())
    })

    it('should execute multiple API calls successfully', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ])

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected to throw due to process.exit
      }

      // Parse the output
      const output = stdoutOutput.join('')
      const results = JSON.parse(output)

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[0].data).toHaveProperty('id', 1)
      expect(results[1].success).toBe(true)
      expect(results[1].data).toHaveProperty('id', 2)
      expect(results[2].success).toBe(true)
      expect(results[2].data).toHaveProperty('id', 3)
    })

    it('should handle mixed success and failure', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '999' }, // Non-existent user
        { id: '2' },
      ])

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected to throw due to process.exit
      }

      const output = stdoutOutput.join('')
      const results = JSON.parse(output)

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBeDefined()
      expect(results[2].success).toBe(true)
      expect(exitCode).toBe(1) // Should exit with error
    })

    it('should format batch results in pretty mode', async () => {
      const batchJson = JSON.stringify([{ id: '1' }, { id: '2' }])

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          pretty: true,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected
      }

      const output = stdoutOutput.join('')

      expect(output).toContain('=== Request 1/2 ===')
      expect(output).toContain('=== Request 2/2 ===')
      expect(output).toContain('✓ Success')
      expect(output).toContain('Summary: 2 succeeded, 0 failed')
    })

    it('should stop on first error with fail-fast', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '999' }, // Will fail
        { id: '2' }, // Should not be called
      ])

      // Mock fetch to track calls
      const fetchSpy = jest.spyOn(global, 'fetch')

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          failFast: true,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected
      }

      const output = stdoutOutput.join('')
      const results = JSON.parse(output)

      // Should only have 2 results, not 3
      expect(results).toHaveLength(2)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      fetchSpy.mockRestore()
    })

    it('should merge CLI parameters with batch parameters', async () => {
      const batchJson = JSON.stringify([
        { id: '1' },
        { id: '2', _limit: '5' },
      ])

      // Mock fetch to capture requests
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (url: any) => {
          const urlString = url.toString()
          if (urlString.includes('/users/1')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 1, name: 'User 1' }),
              text: async () => '{"id": 1, "name": "User 1"}',
            } as any
          } else if (urlString.includes('/users/2')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 2, name: 'User 2' }),
              text: async () => '{"id": 2, "name": "User 2"}',
            } as any
          }
          throw new Error('Unexpected URL')
        })

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          pretty: false,
          path: [],
          query: ['_expand=posts'], // This should apply to all requests
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected
      }

      // Check that CLI query params were added to all requests
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      const firstCall = fetchSpy.mock.calls[0]?.[0]?.toString() ?? ''
      const secondCall = fetchSpy.mock.calls[1]?.[0]?.toString() ?? ''

      expect(firstCall).toContain('_expand=posts')
      expect(secondCall).toContain('_expand=posts')
      expect(secondCall).toContain('_limit=5') // Batch param should also be present

      fetchSpy.mockRestore()
    })

    it('should show progress in debug mode', async () => {
      const batchJson = JSON.stringify([{ id: '1' }, { id: '2' }])

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.getUser',
          batchJson,
          pretty: false,
          debug: true,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected
      }

      const debugOutput = stderrOutput.join('')

      expect(debugOutput).toContain(
        'Starting batch operation with 2 requests',
      )
      expect(debugOutput).toContain('Executing request 1 of 2...')
      expect(debugOutput).toContain('Executing request 2 of 2...')
    })

    it('should handle batch operations with aliases', async () => {
      const batchJson = JSON.stringify([
        {}, // Empty params, should use alias defaults
        { id: '5' }, // Override alias default
      ])

      try {
        await command.handler({
          _: [],
          $0: 'ovrmnd',
          target: 'test-api.me', // Using alias
          batchJson,
          pretty: false,
          path: [],
          query: [],
          header: [],
          body: [],
        })
      } catch (error) {
        // Expected
      }

      const output = stdoutOutput.join('')
      const results = JSON.parse(output)

      expect(results).toHaveLength(2)
      expect(results[0].data).toHaveProperty('id', 1) // Should use alias default
      expect(results[1].data).toHaveProperty('id', 5) // Should use batch override
    })
  })
})
