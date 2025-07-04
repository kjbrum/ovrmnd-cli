import { callEndpoint } from '../../src/api/client'
import type {
  ResolvedServiceConfig,
  EndpointConfig,
} from '../../src/types/config'
import { DebugFormatter } from '../../src/utils/debug'
import flatCache from 'flat-cache'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock fetch globally
const fetchMock = jest.fn()
global.fetch = fetchMock

// Mock flat-cache to control cache behavior
jest.mock('flat-cache')

describe('Client Caching Integration', () => {
  let mockCache: jest.Mocked<flatCache.Cache>
  let debugFormatter: DebugFormatter
  let cacheDir: string

  const mockConfig: ResolvedServiceConfig = {
    serviceName: 'testService',
    baseUrl: 'https://api.example.com',
    endpoints: [],
  }

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

    // Set up debug formatter
    debugFormatter = new DebugFormatter(true)
    jest.spyOn(debugFormatter, 'formatCacheInfo')

    // Set up test cache directory
    cacheDir = path.join(os.tmpdir(), 'ovrmnd-test-cache')
  })

  afterEach(() => {
    jest.clearAllMocks()
    // Clean up test cache directory
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
  })

  describe('GET requests with cacheTTL', () => {
    const endpoint: EndpointConfig = {
      name: 'getUser',
      method: 'GET',
      path: '/users/{id}',
      cacheTTL: 300,
    }

    it('should return cached data on cache hit', async () => {
      const cachedData = { id: '123', name: 'John Doe' }
      const cacheEntry = {
        data: cachedData,
        timestamp: Date.now(),
        ttl: 300,
      }
      mockCache.getKey.mockReturnValue(cacheEntry)

      const result = await callEndpoint(
        mockConfig,
        endpoint,
        { path: { id: '123' } },
        debugFormatter,
      )

      expect(result).toEqual({
        success: true,
        data: cachedData,
        metadata: {
          timestamp: expect.any(Number),
          statusCode: 200,
          cached: true,
        },
      })

      // Should check cache
      expect(mockCache.getKey).toHaveBeenCalled()

      // Should NOT make HTTP request
      expect(fetchMock).not.toHaveBeenCalled()

      // Should log cache hit
      expect(debugFormatter.formatCacheInfo).toHaveBeenCalledWith(
        'getUser',
        expect.any(String),
        true,
        300,
      )
    })

    it('should fetch and cache data on cache miss', async () => {
      mockCache.getKey.mockReturnValue(undefined)

      const responseData = { id: '123', name: 'John Doe' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      })

      const result = await callEndpoint(
        mockConfig,
        endpoint,
        { path: { id: '123' } },
        debugFormatter,
      )

      expect(result).toEqual({
        success: true,
        data: responseData,
        metadata: {
          timestamp: expect.any(Number),
          statusCode: 200,
        },
      })

      // Should check cache
      expect(mockCache.getKey).toHaveBeenCalled()

      // Should make HTTP request
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.any(Object),
      )

      // Should cache the response
      expect(mockCache.setKey).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: responseData,
          ttl: 300,
          timestamp: expect.any(Number),
        }),
      )
      expect(mockCache.save).toHaveBeenCalledWith(true)

      // Should log cache miss
      expect(debugFormatter.formatCacheInfo).toHaveBeenCalledWith(
        'getUser',
        expect.any(String),
        false,
        300,
      )
    })

    it('should handle expired cache entries', async () => {
      const cachedData = { id: '123', name: 'John Doe' }
      const expiredEntry = {
        data: cachedData,
        timestamp: Date.now() - 400000, // 400 seconds ago
        ttl: 300, // 5 minutes TTL
      }
      mockCache.getKey.mockReturnValue(expiredEntry)

      const newData = { id: '123', name: 'Jane Doe' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => newData,
      })

      const result = await callEndpoint(
        mockConfig,
        endpoint,
        { path: { id: '123' } },
        debugFormatter,
      )

      expect(result.data).toEqual(newData)

      // Should remove expired entry
      expect(mockCache.removeKey).toHaveBeenCalled()
      expect(mockCache.save).toHaveBeenCalled()

      // Should make new HTTP request
      expect(fetchMock).toHaveBeenCalled()

      // Should cache new response
      expect(mockCache.setKey).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: newData,
        }),
      )
    })

    it('should continue on cache read error', async () => {
      mockCache.getKey.mockImplementation(() => {
        throw new Error('Cache read error')
      })

      const responseData = { id: '123', name: 'John Doe' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        path: { id: '123' },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(responseData)

      // Should still make the HTTP request
      expect(fetchMock).toHaveBeenCalled()
    })

    it('should continue on cache write error', async () => {
      mockCache.getKey.mockReturnValue(undefined)
      mockCache.setKey.mockImplementation(() => {
        throw new Error('Cache write error')
      })

      const responseData = { id: '123', name: 'John Doe' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        path: { id: '123' },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(responseData)

      // Should attempt to cache
      expect(mockCache.setKey).toHaveBeenCalled()
    })

    it('should not cache non-200 responses', async () => {
      mockCache.getKey.mockReturnValue(undefined)

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not found' }),
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        path: { id: '999' },
      })

      expect(result.success).toBe(false)

      // Should NOT cache error responses
      expect(mockCache.setKey).not.toHaveBeenCalled()
    })
  })

  describe('requests without caching', () => {
    it('should not use cache for POST requests', async () => {
      const endpoint: EndpointConfig = {
        name: 'createUser',
        method: 'POST',
        path: '/users',
        cacheTTL: 300, // Even with TTL, POST should not cache
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '123', name: 'John Doe' }),
      })

      await callEndpoint(mockConfig, endpoint, {
        body: { name: 'John Doe' },
      })

      // Should NOT check or set cache
      expect(mockCache.getKey).not.toHaveBeenCalled()
      expect(mockCache.setKey).not.toHaveBeenCalled()
    })

    it('should not use cache for GET requests without cacheTTL', async () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        // No cacheTTL
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '123', name: 'John Doe' }),
      })

      await callEndpoint(mockConfig, endpoint, {
        path: { id: '123' },
      })

      // Should NOT check or set cache
      expect(mockCache.getKey).not.toHaveBeenCalled()
      expect(mockCache.setKey).not.toHaveBeenCalled()
    })
  })

  describe('cache key generation', () => {
    it('should generate unique keys for different URLs', async () => {
      const endpoint: EndpointConfig = {
        name: 'listUsers',
        method: 'GET',
        path: '/users',
        cacheTTL: 300,
      }

      mockCache.getKey.mockReturnValue(undefined)
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      })

      // First call with page=1
      await callEndpoint(mockConfig, endpoint, {
        query: { page: '1' },
      })

      // Second call with page=2
      await callEndpoint(mockConfig, endpoint, {
        query: { page: '2' },
      })

      // Should generate different cache keys
      const setCalls = mockCache.setKey.mock.calls
      expect(setCalls).toHaveLength(2)
      expect(setCalls[0]?.[0]).not.toBe(setCalls[1]?.[0])
    })

    it('should exclude auth headers from cache key', async () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        cacheTTL: 300,
      }

      // Set up first response in cache
      const cachedData = { id: '123', name: 'Cached User' }
      mockCache.getKey.mockReturnValue({
        data: cachedData,
        timestamp: Date.now(),
        ttl: 300,
      })

      // First call with auth token
      const configWithAuth1: ResolvedServiceConfig = {
        ...mockConfig,
        authentication: {
          type: 'bearer',
          token: 'token-1',
        },
      }

      const result1 = await callEndpoint(configWithAuth1, endpoint, {
        path: { id: '123' },
      })

      // Second call with different auth token
      const configWithAuth2: ResolvedServiceConfig = {
        ...mockConfig,
        authentication: {
          type: 'bearer',
          token: 'token-2',
        },
      }

      const result2 = await callEndpoint(configWithAuth2, endpoint, {
        path: { id: '123' },
      })

      // Both should get same cached data (auth excluded from key)
      expect(result1.data).toEqual(cachedData)
      expect(result2.data).toEqual(cachedData)

      // Should have checked cache with same key both times
      expect(mockCache.getKey).toHaveBeenCalledTimes(2)
    })
  })
})
