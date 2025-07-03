import {
  resolveEnvVars,
  resolveServiceConfig,
  hasEnvVarPlaceholders,
  getEnvVarNames,
} from '../../src/config/env-resolver'
import { ServiceConfig } from '../../src/types/config'
import { OvrmndError } from '../../src/utils/error'

describe('Environment Variable Resolver', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('resolveEnvVars', () => {
    it('should resolve single environment variable', () => {
      process.env['TEST_VAR'] = 'test-value'
      const result = resolveEnvVars('prefix-${TEST_VAR}-suffix')
      expect(result).toBe('prefix-test-value-suffix')
    })

    it('should resolve multiple environment variables', () => {
      process.env['VAR1'] = 'value1'
      process.env['VAR2'] = 'value2'
      const result = resolveEnvVars('${VAR1}-separator-${VAR2}')
      expect(result).toBe('value1-separator-value2')
    })

    it('should throw error for undefined environment variable', () => {
      expect(() => resolveEnvVars('${UNDEFINED_VAR}')).toThrow(
        OvrmndError,
      )
    })

    it('should return string unchanged if no env vars', () => {
      const result = resolveEnvVars('no-env-vars-here')
      expect(result).toBe('no-env-vars-here')
    })
  })

  describe('resolveServiceConfig', () => {
    it('should resolve environment variables in service config', () => {
      process.env['API_URL'] = 'https://api.example.com'
      process.env['API_TOKEN'] = 'secret-token'
      process.env['CUSTOM_HEADER'] = 'header-value'

      const config: ServiceConfig = {
        serviceName: 'test',
        baseUrl: '${API_URL}',
        authentication: {
          type: 'bearer',
          token: '${API_TOKEN}',
        },
        endpoints: [
          {
            name: 'test',
            method: 'GET',
            path: '/test/${CUSTOM_HEADER}',
            headers: {
              'X-Custom': '${CUSTOM_HEADER}',
            },
          },
        ],
      }

      const resolved = resolveServiceConfig(config)

      expect(resolved.baseUrl).toBe('https://api.example.com')
      expect(resolved.authentication?.token).toBe('secret-token')
      expect(resolved.endpoints[0]?.path).toBe('/test/header-value')
      expect(resolved.endpoints[0]?.headers?.['X-Custom']).toBe(
        'header-value',
      )
    })

    it('should handle config without authentication', () => {
      process.env['API_URL'] = 'https://api.example.com'

      const config: ServiceConfig = {
        serviceName: 'test',
        baseUrl: '${API_URL}',
        endpoints: [
          {
            name: 'test',
            method: 'GET',
            path: '/test',
          },
        ],
      }

      const resolved = resolveServiceConfig(config)
      expect(resolved.baseUrl).toBe('https://api.example.com')
      expect(resolved.authentication).toBeUndefined()
    })

    it('should resolve env vars in aliases', () => {
      process.env['USERNAME'] = 'testuser'

      const config: ServiceConfig = {
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        endpoints: [
          {
            name: 'getUser',
            method: 'GET',
            path: '/users/{username}',
          },
        ],
        aliases: [
          {
            name: 'myUser',
            endpoint: 'getUser',
            args: {
              username: '${USERNAME}',
            },
          },
        ],
      }

      const resolved = resolveServiceConfig(config)
      expect(resolved.aliases?.[0]?.args['username']).toBe('testuser')
    })
  })

  describe('hasEnvVarPlaceholders', () => {
    it('should detect env var placeholders', () => {
      expect(hasEnvVarPlaceholders('${TEST}')).toBe(true)
      expect(hasEnvVarPlaceholders('prefix-${TEST}-suffix')).toBe(
        true,
      )
      expect(hasEnvVarPlaceholders('no-placeholders')).toBe(false)
    })
  })

  describe('getEnvVarNames', () => {
    it('should extract env var names', () => {
      expect(getEnvVarNames('${VAR1}')).toEqual(['VAR1'])
      expect(getEnvVarNames('${VAR1}-${VAR2}')).toEqual([
        'VAR1',
        'VAR2',
      ])
      expect(getEnvVarNames('no-vars')).toEqual([])
    })
  })
})
