import {
  buildUrl,
  executeRequest,
  callEndpoint,
} from '../../src/api/client'
import type {
  ResolvedServiceConfig,
  EndpointConfig,
} from '../../src/types/config'
import { OvrmndError, ErrorCode } from '../../src/utils/error'

// Mock fetch globally
global.fetch = jest.fn()

describe('HTTP Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('buildUrl', () => {
    it('should build URL with base and path', () => {
      const url = buildUrl('https://api.example.com', '/users')
      expect(url).toBe('https://api.example.com/users')
    })

    it('should handle base URL with trailing slash', () => {
      const url = buildUrl('https://api.example.com/', '/users')
      expect(url).toBe('https://api.example.com/users')
    })

    it('should handle path without leading slash', () => {
      const url = buildUrl('https://api.example.com', 'users')
      expect(url).toBe('https://api.example.com/users')
    })

    it('should replace path parameters', () => {
      const url = buildUrl(
        'https://api.example.com',
        '/users/{userId}/posts/{postId}',
        { userId: '123', postId: '456' },
      )
      expect(url).toBe('https://api.example.com/users/123/posts/456')
    })

    it('should URL encode path parameters', () => {
      const url = buildUrl(
        'https://api.example.com',
        '/search/{query}',
        { query: 'hello world' },
      )
      expect(url).toBe('https://api.example.com/search/hello%20world')
    })
  })

  describe('executeRequest', () => {
    it('should execute successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await executeRequest({
        method: 'GET',
        url: 'https://api.example.com/users/1',
      })

      expect(result).toEqual({
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
          headers: {},
        }),
      )
    })

    it('should handle JSON body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ id: 2 }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await executeRequest({
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'New User' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New User' }),
        }),
      )
    })

    it('should handle text response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('Plain text response'),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await executeRequest({
        method: 'GET',
        url: 'https://api.example.com/text',
      })

      expect(result.data).toBe('Plain text response')
    })

    it('should throw error for HTTP error status', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest
          .fn()
          .mockResolvedValue({ error: 'User not found' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await expect(
        executeRequest({
          method: 'GET',
          url: 'https://api.example.com/users/999',
        }),
      ).rejects.toThrow(OvrmndError)

      try {
        await executeRequest({
          method: 'GET',
          url: 'https://api.example.com/users/999',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(OvrmndError)
        expect((error as OvrmndError).code).toBe(
          ErrorCode.API_REQUEST_FAILED,
        )
        expect((error as OvrmndError).statusCode).toBe(404)
      }
    })

    it('should handle timeout', async () => {
      // Create a mock that simulates AbortError
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      ;(global.fetch as jest.Mock).mockRejectedValue(abortError)

      await expect(
        executeRequest({
          method: 'GET',
          url: 'https://api.example.com/slow',
          timeout: 100, // 100ms timeout
        }),
      ).rejects.toThrow(OvrmndError)

      try {
        await executeRequest({
          method: 'GET',
          url: 'https://api.example.com/slow',
          timeout: 100,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(OvrmndError)
        expect((error as OvrmndError).code).toBe(
          ErrorCode.API_TIMEOUT,
        )
      }
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )

      await expect(
        executeRequest({
          method: 'GET',
          url: 'https://api.example.com/users',
        }),
      ).rejects.toThrow(OvrmndError)

      try {
        await executeRequest({
          method: 'GET',
          url: 'https://api.example.com/users',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(OvrmndError)
        expect((error as OvrmndError).code).toBe(
          ErrorCode.API_REQUEST_FAILED,
        )
        expect((error as OvrmndError).message).toContain(
          'Network error',
        )
      }
    })
  })

  describe('callEndpoint', () => {
    const config: ResolvedServiceConfig = {
      serviceName: 'test',
      baseUrl: 'https://api.example.com',
      endpoints: [],
      authentication: {
        type: 'bearer',
        token: 'test-token',
      },
    }

    const endpoint: EndpointConfig = {
      name: 'getUser',
      method: 'GET',
      path: '/users/{userId}',
      headers: {
        'X-Custom': 'value',
      },
    }

    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest
          .fn()
          .mockResolvedValue({ id: 1, name: 'Test User' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
    })

    it('should call endpoint with path parameters', async () => {
      await callEndpoint(config, endpoint, {
        path: { userId: '123' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
            Authorization: 'Bearer test-token',
          }),
        }),
      )
    })

    it('should add query parameters', async () => {
      await callEndpoint(config, endpoint, {
        path: { userId: '123' },
        query: { include: 'posts', limit: '10' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123?include=posts&limit=10',
        expect.any(Object),
      )
    })

    it('should handle array query parameters', async () => {
      await callEndpoint(config, endpoint, {
        path: { userId: '123' },
        query: { tags: ['javascript', 'typescript'] },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123?tags=javascript&tags=typescript',
        expect.any(Object),
      )
    })

    it('should merge headers', async () => {
      await callEndpoint(config, endpoint, {
        path: { userId: '123' },
        headers: { 'X-Request-ID': 'abc123' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
            'X-Request-ID': 'abc123',
            Authorization: 'Bearer test-token',
          }),
        }),
      )
    })

    it('should pass body for POST requests', async () => {
      const postEndpoint: EndpointConfig = {
        name: 'createUser',
        method: 'POST',
        path: '/users',
      }

      await callEndpoint(config, postEndpoint, {
        body: { name: 'New User', email: 'user@example.com' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'New User',
            email: 'user@example.com',
          }),
        }),
      )
    })
  })
})
