import { CacheCommand } from '../../src/commands/cache'
import { CacheStorage } from '../../src/cache/storage'
import { OutputFormatter } from '../../src/utils/output'
import prompts from 'prompts'

jest.mock('../../src/cache/storage')
jest.mock('../../src/utils/output')
jest.mock('prompts')

describe('CacheCommand', () => {
  let command: CacheCommand
  let mockCacheStorage: jest.Mocked<CacheStorage>
  let mockFormatter: jest.Mocked<OutputFormatter>
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock CacheStorage
    mockCacheStorage = {
      clear: jest.fn(),
      clearPattern: jest.fn().mockReturnValue(5),
      getStats: jest
        .fn()
        .mockReturnValue({ totalEntries: 10, totalSize: 1024 }),
      getAllEntries: jest.fn().mockReturnValue([
        {
          key: 'github.listRepos.abc123',
          age: 60,
          ttl: 300,
          expired: false,
          size: 512,
        },
        {
          key: 'weather.current.def456',
          age: 400,
          ttl: 300,
          expired: true,
          size: 256,
        },
      ]),
      getRawEntry: jest.fn().mockImplementation(key => {
        if (key === 'github.listRepos.abc123') {
          return {
            data: { test: 'data' },
            timestamp: Date.now() - 60000,
            ttl: 300,
            metadata: {
              service: 'github',
              endpoint: 'listRepos',
              url: 'https://api.github.com/repos',
            },
          }
        }
        if (key === 'weather.current.def456') {
          return {
            data: { weather: 'sunny' },
            timestamp: Date.now() - 400000,
            ttl: 300,
            metadata: {
              service: 'weather',
              endpoint: 'current',
              url: 'https://api.weather.com/current',
            },
          }
        }
        return undefined
      }),
    } as any
    ;(
      CacheStorage as jest.MockedClass<typeof CacheStorage>
    ).mockImplementation(() => mockCacheStorage)

    // Mock OutputFormatter
    mockFormatter = {
      isJsonMode: false,
      format: jest
        .fn()
        .mockImplementation(data => JSON.stringify(data)),
      formatError: jest
        .fn()
        .mockImplementation(error => `Error: ${error}`),
      success: jest.fn().mockImplementation(msg => `✓ ${msg}`),
      warning: jest.fn().mockImplementation(msg => `⚠ ${msg}`),
      table: jest.fn().mockImplementation(() => 'mocked table'),
    } as any
    ;(
      OutputFormatter as jest.MockedClass<typeof OutputFormatter>
    ).mockImplementation(() => mockFormatter)

    // Mock prompts
    ;(prompts as unknown as jest.Mock).mockResolvedValue({
      confirm: true,
    })

    // Mock console methods
    jest.spyOn(process.stdout, 'write').mockImplementation()
    jest.spyOn(process.stderr, 'write').mockImplementation()
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('process.exit')
      })

    command = new CacheCommand()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('command structure', () => {
    it('should have correct command string', () => {
      expect(command.command).toBe('cache <action> [target]')
    })

    it('should have correct description', () => {
      expect(command.describe).toBe('Manage response cache')
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

      expect(yargs.positional).toHaveBeenCalledWith('action', {
        describe: 'Cache action to perform',
        type: 'string',
        choices: ['clear', 'stats', 'list'],
        demandOption: true,
      })

      expect(yargs.positional).toHaveBeenCalledWith('target', {
        describe: 'Service or service.endpoint to target',
        type: 'string',
      })

      expect(yargs.option).toHaveBeenCalledWith('force', {
        alias: 'f',
        describe: 'Skip confirmation prompts',
        type: 'boolean',
        default: false,
      })

      expect(yargs.option).toHaveBeenCalledWith('verbose', {
        alias: 'v',
        describe: 'Show detailed information',
        type: 'boolean',
        default: false,
      })
    })
  })

  describe('clear action', () => {
    it('should clear all cache with confirmation', async () => {
      const args = {
        action: 'clear',
        pretty: true,
        force: false,
      }

      await command.handler(args as any)

      expect(prompts).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirm',
        message: 'Clear ALL cache entries?',
        initial: false,
      })

      expect(mockCacheStorage.getStats).toHaveBeenCalled()
      expect(mockCacheStorage.clear).toHaveBeenCalled()
      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cleared 10 cache entries',
      )
    })

    it('should skip confirmation with force flag', async () => {
      const args = {
        action: 'clear',
        pretty: true,
        force: true,
      }

      await command.handler(args as any)

      expect(prompts).not.toHaveBeenCalled()
      expect(mockCacheStorage.clear).toHaveBeenCalled()
    })

    it('should clear specific service pattern', async () => {
      const args = {
        action: 'clear',
        target: 'github',
        pretty: true,
        force: true,
      }

      await command.handler(args as any)

      expect(mockCacheStorage.clearPattern).toHaveBeenCalledWith(
        'github',
      )
      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cleared 5 cache entries',
      )
    })

    it('should handle no entries to clear', async () => {
      mockCacheStorage.clearPattern.mockReturnValue(0)

      const args = {
        action: 'clear',
        target: 'nonexistent',
        pretty: true,
        force: true,
      }

      await command.handler(args as any)

      expect(mockFormatter.warning).toHaveBeenCalledWith(
        'No cache entries to clear',
      )
    })

    it('should handle cancelled confirmation', async () => {
      ;(prompts as unknown as jest.Mock).mockResolvedValue({
        confirm: false,
      })

      const args = {
        action: 'clear',
        pretty: true,
        force: false,
      }

      await command.handler(args as any)

      expect(mockCacheStorage.clear).not.toHaveBeenCalled()
      expect(mockFormatter.warning).toHaveBeenCalledWith(
        'Cache clear cancelled',
      )
    })

    it('should output JSON in JSON mode', async () => {
      Object.defineProperty(mockFormatter, 'isJsonMode', {
        value: true,
        writable: true,
      })

      const args = {
        action: 'clear',
        pretty: false,
        force: true,
      }

      await command.handler(args as any)

      expect(prompts).not.toHaveBeenCalled() // No confirmation in JSON mode
      expect(mockFormatter.format).toHaveBeenCalledWith({
        action: 'clear',
        target: 'all',
        cleared: 10,
        success: true,
      })
    })
  })

  describe('stats action', () => {
    it('should show cache statistics', async () => {
      const args = {
        action: 'stats',
        pretty: true,
        verbose: false,
      }

      await command.handler(args as any)

      expect(mockCacheStorage.getStats).toHaveBeenCalled()
      expect(mockCacheStorage.getAllEntries).toHaveBeenCalled()
      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cache Statistics:\n',
      )
    })

    it('should show detailed stats with verbose flag', async () => {
      const args = {
        action: 'stats',
        pretty: true,
        verbose: true,
      }

      await command.handler(args as any)

      expect(mockFormatter.table).toHaveBeenCalled()
    })

    it('should output JSON in JSON mode', async () => {
      Object.defineProperty(mockFormatter, 'isJsonMode', {
        value: true,
        writable: true,
      })

      const args = {
        action: 'stats',
        pretty: false,
      }

      await command.handler(args as any)

      expect(mockFormatter.format).toHaveBeenCalledWith(
        expect.objectContaining({
          totalEntries: 10,
          totalSize: 1024,
          byService: expect.any(Object),
        }),
      )
    })
  })

  describe('list action', () => {
    it('should list all cache entries', async () => {
      const args = {
        action: 'list',
        pretty: true,
        verbose: false,
      }

      await command.handler(args as any)

      expect(mockCacheStorage.getAllEntries).toHaveBeenCalled()
      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cached entries:\n',
      )
      expect(mockFormatter.table).toHaveBeenCalled()
    })

    it('should filter by target', async () => {
      const args = {
        action: 'list',
        target: 'github',
        pretty: true,
        verbose: false,
      }

      await command.handler(args as any)

      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cached entries for github:\n',
      )
    })

    it('should show detailed view with verbose flag', async () => {
      const args = {
        action: 'list',
        pretty: true,
        verbose: true,
      }

      await command.handler(args as any)

      // In verbose mode, detailed info is shown
      expect(mockCacheStorage.getAllEntries).toHaveBeenCalled()
      expect(mockFormatter.success).toHaveBeenCalledWith(
        'Cached entries:\n',
      )
    })

    it('should handle empty cache', async () => {
      mockCacheStorage.getAllEntries.mockReturnValue([])

      const args = {
        action: 'list',
        pretty: true,
      }

      await command.handler(args as any)

      expect(mockFormatter.warning).toHaveBeenCalledWith(
        'No cached entries found',
      )
    })

    it('should output JSON in JSON mode', async () => {
      Object.defineProperty(mockFormatter, 'isJsonMode', {
        value: true,
        writable: true,
      })

      const args = {
        action: 'list',
        pretty: false,
      }

      await command.handler(args as any)

      expect(mockFormatter.format).toHaveBeenCalledWith({
        entries: expect.any(Array),
      })
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      mockCacheStorage.getStats.mockImplementation(() => {
        throw new Error('Cache error')
      })

      const args = {
        action: 'stats',
        pretty: true,
      }

      await expect(command.handler(args as any)).rejects.toThrow(
        'process.exit',
      )

      expect(mockFormatter.formatError).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('formatting utilities', () => {
    it('should format bytes correctly', () => {
      const formatBytes = (command as any).formatBytes.bind(command)

      expect(formatBytes(512)).toBe('512.0 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1048576)).toBe('1.0 MB')
      expect(formatBytes(1073741824)).toBe('1.0 GB')
    })

    it('should format duration correctly', () => {
      const formatDuration = (command as any).formatDuration.bind(
        command,
      )

      expect(formatDuration(0)).toBe('expired')
      expect(formatDuration(-1000)).toBe('expired')
      expect(formatDuration(30000)).toBe('30s')
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(3660000)).toBe('1h 1m')
      expect(formatDuration(90000000)).toBe('1d 1h')
    })

    it('should format relative time correctly', () => {
      const formatRelativeTime = (
        command as any
      ).formatRelativeTime.bind(command)
      const now = Date.now()

      expect(formatRelativeTime(now - 30000)).toBe('now')
      expect(formatRelativeTime(now - 120000)).toBe('2m ago')
      expect(formatRelativeTime(now - 3700000)).toBe('1h ago')
      expect(formatRelativeTime(now - 86400000)).toBe('1d ago')
      expect(formatRelativeTime(now + 120000)).toBe('in 2m')
    })
  })
})
