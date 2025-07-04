import { CacheStorage } from '../../src/cache/storage'
import flatCache from 'flat-cache'
import path from 'path'
import os from 'os'
import { OvrmndError } from '../../src/utils/error'

// Mock flat-cache
jest.mock('flat-cache')

describe('CacheStorage', () => {
  let cacheStorage: CacheStorage
  let mockCache: jest.Mocked<flatCache.Cache>

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock cache instance
    mockCache = {
      getKey: jest.fn(),
      setKey: jest.fn(),
      removeKey: jest.fn(),
      save: jest.fn(),
      destroy: jest.fn(),
      keys: jest.fn(() => []),
    } as unknown as jest.Mocked<flatCache.Cache>

    // Mock flatCache.load to return our mock
    ;(flatCache.load as jest.Mock).mockReturnValue(mockCache)

    cacheStorage = new CacheStorage()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should use default cache directory', () => {
      new CacheStorage()
      expect(flatCache.load).toHaveBeenCalledWith(
        'api-responses',
        path.join(os.homedir(), '.ovrmnd', 'cache'),
      )
    })

    it('should use custom cache directory', () => {
      const customDir = '/custom/cache/dir'
      new CacheStorage(customDir)
      expect(flatCache.load).toHaveBeenCalledWith(
        'api-responses',
        customDir,
      )
    })
  })

  describe('generateKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        { Accept: 'application/json' },
      )
      const key2 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        { Accept: 'application/json' },
      )

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^github\.listRepos\.[a-f0-9]{16}$/)
    })

    it('should generate different keys for different URLs', () => {
      const key1 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        {},
      )
      const key2 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos?page=2',
        {},
      )

      expect(key1).not.toBe(key2)
    })

    it('should exclude sensitive headers from key generation', () => {
      const key1 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
      )
      const key2 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        {
          authorization: 'Bearer different-token',
          'content-type': 'application/json',
        },
      )

      expect(key1).toBe(key2)
    })

    it('should include non-sensitive headers in key generation', () => {
      const key1 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        { Accept: 'application/json' },
      )
      const key2 = cacheStorage.generateKey(
        'github',
        'listRepos',
        'https://api.github.com/repos',
        { Accept: 'application/xml' },
      )

      expect(key1).not.toBe(key2)
    })
  })

  describe('get', () => {
    it('should return null for non-existent key', () => {
      mockCache.getKey.mockReturnValue(undefined)

      const result = cacheStorage.get('non-existent-key')

      expect(result).toBeNull()
      expect(mockCache.getKey).toHaveBeenCalledWith(
        'non-existent-key',
      )
    })

    it('should return cached data for valid entry', () => {
      const cachedData = { foo: 'bar' }
      const entry = {
        data: cachedData,
        timestamp: Date.now(),
        ttl: 300,
      }
      mockCache.getKey.mockReturnValue(entry)

      const result = cacheStorage.get('valid-key')

      expect(result).toEqual(cachedData)
    })

    it('should return null for expired entry', () => {
      const entry = {
        data: { foo: 'bar' },
        timestamp: Date.now() - 400000, // 400 seconds ago
        ttl: 300, // 5 minutes TTL
      }
      mockCache.getKey.mockReturnValue(entry)

      const result = cacheStorage.get('expired-key')

      expect(result).toBeNull()
      expect(mockCache.removeKey).toHaveBeenCalledWith('expired-key')
      expect(mockCache.save).toHaveBeenCalledWith(true)
    })

    it('should throw OvrmndError on cache read error', () => {
      mockCache.getKey.mockImplementation(() => {
        throw new Error('Read error')
      })

      expect(() => cacheStorage.get('error-key')).toThrow(OvrmndError)
      expect(() => cacheStorage.get('error-key')).toThrow(
        /Failed to read from cache/,
      )
    })
  })

  describe('set', () => {
    it('should store data with metadata', () => {
      const data = { foo: 'bar' }
      const ttl = 300
      const beforeTime = Date.now()

      cacheStorage.set('test-key', data, ttl)

      const afterTime = Date.now()
      expect(mockCache.setKey).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          data,
          ttl,
          timestamp: expect.any(Number),
        }),
      )

      const call = mockCache.setKey.mock.calls[0]?.[1]
      expect(call?.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(call?.timestamp).toBeLessThanOrEqual(afterTime)
      expect(mockCache.save).toHaveBeenCalledWith(true)
    })

    it('should throw OvrmndError on cache write error', () => {
      mockCache.setKey.mockImplementation(() => {
        throw new Error('Write error')
      })

      expect(() => cacheStorage.set('error-key', {}, 300)).toThrow(
        OvrmndError,
      )
      expect(() => cacheStorage.set('error-key', {}, 300)).toThrow(
        /Failed to write to cache/,
      )
    })
  })

  describe('clear', () => {
    it('should destroy and reinitialize cache', () => {
      cacheStorage.clear()

      expect(mockCache.destroy).toHaveBeenCalled()
      expect(flatCache.load).toHaveBeenCalledTimes(2) // Once in constructor, once in clear
    })

    it('should throw OvrmndError on clear error', () => {
      mockCache.destroy.mockImplementation(() => {
        throw new Error('Destroy error')
      })

      expect(() => cacheStorage.clear()).toThrow(OvrmndError)
      expect(() => cacheStorage.clear()).toThrow(
        /Failed to clear cache/,
      )
    })
  })

  describe('clearPattern', () => {
    it('should clear entries matching pattern', () => {
      mockCache.keys.mockReturnValue([
        'github.listRepos.abc123',
        'github.getUser.def456',
        'twitter.getTweets.ghi789',
      ])

      const cleared = cacheStorage.clearPattern('github.')

      expect(cleared).toBe(2)
      expect(mockCache.removeKey).toHaveBeenCalledWith(
        'github.listRepos.abc123',
      )
      expect(mockCache.removeKey).toHaveBeenCalledWith(
        'github.getUser.def456',
      )
      expect(mockCache.removeKey).not.toHaveBeenCalledWith(
        'twitter.getTweets.ghi789',
      )
      expect(mockCache.save).toHaveBeenCalledWith(true)
    })

    it('should not save if no entries cleared', () => {
      mockCache.keys.mockReturnValue(['twitter.getTweets.ghi789'])

      const cleared = cacheStorage.clearPattern('github.')

      expect(cleared).toBe(0)
      expect(mockCache.save).not.toHaveBeenCalled()
    })

    it('should throw OvrmndError on pattern clear error', () => {
      mockCache.keys.mockImplementation(() => {
        throw new Error('Keys error')
      })

      expect(() => cacheStorage.clearPattern('pattern')).toThrow(
        OvrmndError,
      )
      expect(() => cacheStorage.clearPattern('pattern')).toThrow(
        /Failed to clear cache pattern/,
      )
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const entry1 = {
        data: { a: 1 },
        timestamp: Date.now(),
        ttl: 300,
      }
      const entry2 = {
        data: { b: 2, c: 3 },
        timestamp: Date.now(),
        ttl: 600,
      }

      mockCache.keys.mockReturnValue(['key1', 'key2'])
      mockCache.getKey
        .mockReturnValueOnce(entry1)
        .mockReturnValueOnce(entry2)

      const stats = cacheStorage.getStats()

      expect(stats.totalEntries).toBe(2)
      expect(stats.totalSize).toBe(
        JSON.stringify(entry1).length + JSON.stringify(entry2).length,
      )
    })

    it('should handle missing entries', () => {
      mockCache.keys.mockReturnValue(['key1', 'key2', 'key3'])
      mockCache.getKey
        .mockReturnValueOnce({
          data: {},
          timestamp: Date.now(),
          ttl: 300,
        })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({
          data: {},
          timestamp: Date.now(),
          ttl: 300,
        })

      const stats = cacheStorage.getStats()

      expect(stats.totalEntries).toBe(3)
      expect(stats.totalSize).toBeGreaterThan(0)
    })
  })

  describe('getAllEntries', () => {
    it('should return all cache entries with metadata', () => {
      const now = Date.now()
      const entry1 = {
        data: { a: 1 },
        timestamp: now - 100000, // 100 seconds ago
        ttl: 300,
      }
      const entry2 = {
        data: { b: 2 },
        timestamp: now - 400000, // 400 seconds ago
        ttl: 300,
      }

      mockCache.keys.mockReturnValue(['key1', 'key2'])
      mockCache.getKey
        .mockReturnValueOnce(entry1)
        .mockReturnValueOnce(entry2)

      const entries = cacheStorage.getAllEntries()

      expect(entries).toHaveLength(2)
      expect(entries[0]).toMatchObject({
        key: 'key1',
        age: expect.any(Number),
        ttl: 300,
        expired: false,
        size: JSON.stringify(entry1).length,
      })
      expect(entries[1]).toMatchObject({
        key: 'key2',
        age: expect.any(Number),
        ttl: 300,
        expired: true,
        size: JSON.stringify(entry2).length,
      })
    })

    it('should handle missing entries', () => {
      mockCache.keys.mockReturnValue(['key1', 'key2'])
      mockCache.getKey
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({
          data: {},
          timestamp: Date.now(),
          ttl: 300,
        })

      const entries = cacheStorage.getAllEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]?.key).toBe('key2')
    })
  })
})
