import {
  applyAuth,
  applyApiKeyToQuery,
  isAuthRequired,
  validateAuth,
  redactAuth,
} from '../../src/api/auth'
import type { ResolvedServiceConfig } from '../../src/types/config'
import { OvrmndError } from '../../src/utils/error'

describe('Authentication', () => {
  const baseConfig: ResolvedServiceConfig = {
    serviceName: 'test',
    baseUrl: 'https://api.example.com',
    endpoints: [],
  }

  describe('applyAuth', () => {
    it('should return headers unchanged when no auth configured', () => {
      const headers = { 'Content-Type': 'application/json' }
      const result = applyAuth(baseConfig, headers)
      expect(result).toEqual(headers)
    })

    it('should apply Bearer token authentication', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: 'my-secret-token',
        },
      }

      const result = applyAuth(config)
      expect(result).toEqual({
        Authorization: 'Bearer my-secret-token',
      })
    })

    it('should apply API key authentication with default header', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'apikey',
          token: 'my-api-key',
        },
      }

      const result = applyAuth(config)
      expect(result).toEqual({
        'X-API-Key': 'my-api-key',
      })
    })

    it('should apply API key authentication with custom header', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'apikey',
          token: 'my-api-key',
          header: 'X-Custom-Auth',
        },
      }

      const result = applyAuth(config)
      expect(result).toEqual({
        'X-Custom-Auth': 'my-api-key',
      })
    })

    it('should preserve existing headers', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: 'my-token',
        },
      }

      const headers = { 'Content-Type': 'application/json' }
      const result = applyAuth(config, headers)

      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      })
    })
  })

  describe('applyApiKeyToQuery', () => {
    it('should add API key to query parameters', () => {
      const auth = {
        type: 'apikey' as const,
        token: 'my-api-key',
      }

      const params = new URLSearchParams({ foo: 'bar' })
      const result = applyApiKeyToQuery(auth, params)

      expect(result.get('foo')).toBe('bar')
      expect(result.get('api_key')).toBe('my-api-key')
    })

    it('should use custom parameter name', () => {
      const auth = {
        type: 'apikey' as const,
        token: 'my-api-key',
      }

      const params = new URLSearchParams()
      const result = applyApiKeyToQuery(auth, params, 'custom_key')

      expect(result.get('custom_key')).toBe('my-api-key')
    })

    it('should throw error for non-apikey auth type', () => {
      const auth = {
        type: 'bearer' as const,
        token: 'my-token',
      }

      const params = new URLSearchParams()
      expect(() => applyApiKeyToQuery(auth, params)).toThrow(
        OvrmndError,
      )
    })
  })

  describe('isAuthRequired', () => {
    it('should return false when no auth configured', () => {
      expect(isAuthRequired(baseConfig)).toBe(false)
    })

    it('should return true when auth is configured', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: 'token',
        },
      }

      expect(isAuthRequired(config)).toBe(true)
    })
  })

  describe('validateAuth', () => {
    it('should pass when no auth configured', () => {
      expect(() => validateAuth(baseConfig)).not.toThrow()
    })

    it('should pass with valid bearer auth', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: 'valid-token',
        },
      }

      expect(() => validateAuth(config)).not.toThrow()
    })

    it('should throw for empty token', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: '',
        },
      }

      expect(() => validateAuth(config)).toThrow(OvrmndError)
    })

    it('should throw for whitespace-only token', () => {
      const config: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'bearer',
          token: '   ',
        },
      }

      expect(() => validateAuth(config)).toThrow(OvrmndError)
    })

    it('should validate custom header name format', () => {
      const validConfig: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'apikey',
          token: 'key',
          header: 'X-Custom-Key-123',
        },
      }

      expect(() => validateAuth(validConfig)).not.toThrow()

      const invalidConfig: ResolvedServiceConfig = {
        ...baseConfig,
        authentication: {
          type: 'apikey',
          token: 'key',
          header: 'Invalid Header!',
        },
      }

      expect(() => validateAuth(invalidConfig)).toThrow(OvrmndError)
    })
  })

  describe('redactAuth', () => {
    it('should redact Authorization header', () => {
      const headers = {
        Authorization: 'Bearer my-secret-token-12345',
        'Content-Type': 'application/json',
      }

      const redacted = redactAuth(headers)
      expect(redacted['Authorization']).toBe('Bear...2345')
      expect(redacted['Content-Type']).toBe('application/json')
    })

    it('should redact API key headers', () => {
      const headers = {
        'X-API-Key': 'abcd1234efgh5678',
        'X-Custom-Header': 'not-sensitive',
      }

      const redacted = redactAuth(headers)
      expect(redacted['X-API-Key']).toBe('abcd...5678')
      expect(redacted['X-Custom-Header']).toBe('not-sensitive')
    })

    it('should handle short tokens', () => {
      const headers = {
        'X-API-Key': 'short',
      }

      const redacted = redactAuth(headers)
      expect(redacted['X-API-Key']).toBe('***REDACTED***')
    })

    it('should handle case-insensitive header matching', () => {
      const headers = {
        'x-api-key': 'secret123456789',
        authorization: 'Bearer token123456',
      }

      const redacted = redactAuth(headers)
      expect(redacted['x-api-key']).toBe('secr...6789')
      expect(redacted['authorization']).toBe('Bear...3456')
    })
  })
})
