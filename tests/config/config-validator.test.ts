import { ConfigValidator } from '../../src/config/config-validator'
import * as fs from 'fs/promises'
import { validateServiceConfig } from '../../src/config/validator'

jest.mock('fs/promises')
jest.mock('../../src/config/validator', () => {
  const actual = jest.requireActual('../../src/config/validator')
  return {
    ...actual,
    validateServiceConfig: jest.fn(),
  }
})

describe('ConfigValidator', () => {
  let validator: ConfigValidator
  let mockReadFile: jest.MockedFunction<typeof fs.readFile>
  let mockValidateServiceConfig: jest.MockedFunction<
    typeof validateServiceConfig
  >

  const validYaml = `
serviceName: test-service
baseUrl: https://api.example.com
authentication:
  type: bearer
  token: \${API_TOKEN}
endpoints:
  - name: getUser
    method: GET
    path: /users/{id}
  - name: createUser
    method: POST
    path: /users
aliases:
  - name: me
    endpoint: getUser
    args:
      id: current
`

  beforeEach(() => {
    jest.clearAllMocks()
    validator = new ConfigValidator({ checkEnvVars: true })
    mockReadFile = fs.readFile as jest.MockedFunction<
      typeof fs.readFile
    >
    mockValidateServiceConfig =
      validateServiceConfig as jest.MockedFunction<
        typeof validateServiceConfig
      >
  })

  describe('validateFile', () => {
    it('should validate a valid YAML file', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test-service',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: '${API_TOKEN}' },
        endpoints: [
          { name: 'getUser', method: 'GET', path: '/users/{id}' },
          { name: 'createUser', method: 'POST', path: '/users' },
        ],
        aliases: [
          {
            name: 'me',
            endpoint: 'getUser',
            args: { id: 'current' },
          },
        ],
      } as any)

      // Set environment variable so it doesn't warn
      process.env['API_TOKEN'] = 'test-token'

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.file).toBe('/path/to/config.yaml')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)

      delete process.env['API_TOKEN']
    })

    it('should catch YAML syntax errors with line numbers', async () => {
      const invalidYaml = `
serviceName: test
  baseUrl: https://api.example.com  # Bad indentation
endpoints:
  - name: test
`
      mockReadFile.mockResolvedValue(invalidYaml)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain('YAML syntax error')
      expect(result.errors[0]?.line).toBeDefined()
    })

    it('should catch schema validation errors', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockImplementation(() => {
        throw new Error(
          'Invalid configuration in /path/to/config.yaml:\n  - baseUrl: Required',
        )
      })

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Invalid configuration'),
        }),
      )
    })

    it('should handle file read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'))

      const result = await validator.validateFile(
        '/path/to/nonexistent.yaml',
      )

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain(
        'Failed to read file: File not found',
      )
    })
  })

  describe('semantic validation', () => {
    it('should warn about missing authentication', async () => {
      const noAuthYaml = `
serviceName: test
baseUrl: https://api.example.com
endpoints:
  - name: test
    method: GET
    path: /test
`
      mockReadFile.mockResolvedValue(noAuthYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        endpoints: [{ name: 'test', method: 'GET', path: '/test' }],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'No authentication configured',
          ),
        }),
      )
    })

    it('should detect duplicate path parameters', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: 'test' },
        endpoints: [
          {
            name: 'test',
            method: 'GET',
            path: '/users/{id}/posts/{id}',
          }, // Duplicate {id}
        ],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Duplicate path parameters',
          ),
        }),
      )
    })

    it('should warn about cache TTL on non-GET endpoints', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: 'test' },
        endpoints: [
          {
            name: 'create',
            method: 'POST',
            path: '/users',
            cacheTTL: 300,
          },
        ],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Cache TTL on non-GET endpoint',
          ),
        }),
      )
    })

    it('should validate alias references', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: 'test' },
        endpoints: [
          { name: 'getUser', method: 'GET', path: '/users/{id}' },
        ],
        aliases: [
          { name: 'test', endpoint: 'nonexistent', args: {} },
        ],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            "references unknown endpoint 'nonexistent'",
          ),
        }),
      )
    })

    it('should warn about missing required path parameters in aliases', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: 'test' },
        endpoints: [
          { name: 'getUser', method: 'GET', path: '/users/{id}' },
        ],
        aliases: [{ name: 'current', endpoint: 'getUser', args: {} }], // Missing id
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'missing required path parameters',
          ),
        }),
      )
    })

    it('should check for duplicate names across endpoints and aliases', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        authentication: { type: 'bearer', token: 'test' },
        endpoints: [
          { name: 'test', method: 'GET', path: '/test' },
          { name: 'test', method: 'POST', path: '/test' }, // Duplicate
        ],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Duplicate name 'test'"),
        }),
      )
    })

    it('should warn about missing environment variables', async () => {
      delete process.env['MISSING_VAR']
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: '${MISSING_VAR}',
        endpoints: [],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            "Environment variable 'MISSING_VAR' is not set",
          ),
        }),
      )
    })

    it('should validate base URL format', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'not-a-url',
        endpoints: [],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Base URL must start with http:// or https://',
          ),
        }),
      )
    })

    it('should warn about trailing slash in base URL', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com/',
        endpoints: [],
      } as any)

      const result = await validator.validateFile(
        '/path/to/config.yaml',
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'Base URL ends with a slash',
          ),
        }),
      )
    })
  })

  describe('validateFiles', () => {
    it('should validate multiple files', async () => {
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        endpoints: [],
      } as any)

      const files = ['/path/to/config1.yaml', '/path/to/config2.yaml']
      const results = await validator.validateFiles(files)

      expect(results).toHaveLength(2)
      expect(results[0]?.file).toBe('/path/to/config1.yaml')
      expect(results[1]?.file).toBe('/path/to/config2.yaml')
    })
  })

  describe('strict mode', () => {
    it('should not affect validation logic', async () => {
      const strictValidator = new ConfigValidator({ strict: true })
      mockReadFile.mockResolvedValue(validYaml)
      mockValidateServiceConfig.mockReturnValue({
        serviceName: 'test',
        baseUrl: 'https://api.example.com',
        endpoints: [],
        authentication: { type: 'bearer', token: 'test' },
      } as any)

      const result = await strictValidator.validateFile(
        '/path/to/config.yaml',
      )

      // Strict mode is handled by the command, not the validator
      expect(result.valid).toBe(true)
    })
  })
})
