import { AIConfigGenerator } from '../../src/services/ai-config-generator'
import { OvrmndError } from '../../src/utils/error'
import Anthropic from '@anthropic-ai/sdk'

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk')

describe('AIConfigGenerator', () => {
  const mockApiKey = 'test-api-key'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: mockApiKey }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('should throw error if API key is not set', () => {
      delete process.env['ANTHROPIC_API_KEY']

      expect(() => new AIConfigGenerator()).toThrow(OvrmndError)
      expect(() => new AIConfigGenerator()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required for AI generation',
      )
    })

    it('should initialize client with API key', () => {
      new AIConfigGenerator()

      expect(Anthropic).toHaveBeenCalledWith({ apiKey: mockApiKey })
    })

    it('should use custom model from environment variable', () => {
      process.env['AI_MODEL'] = 'claude-3-5-sonnet-20241022'
      
      new AIConfigGenerator()
      
      // Model should be set but we can't directly access private property
      // Will be tested in generateConfig tests
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: mockApiKey })
    })

    it('should throw error for invalid AI_MAX_TOKENS', () => {
      process.env['AI_MAX_TOKENS'] = 'invalid'

      expect(() => new AIConfigGenerator()).toThrow(OvrmndError)
      expect(() => new AIConfigGenerator()).toThrow(
        'AI_MAX_TOKENS must be a positive integer',
      )

      process.env['AI_MAX_TOKENS'] = '-100'
      expect(() => new AIConfigGenerator()).toThrow(
        'AI_MAX_TOKENS must be a positive integer',
      )
    })

    it('should throw error for invalid AI_TEMPERATURE', () => {
      process.env['AI_TEMPERATURE'] = 'invalid'

      expect(() => new AIConfigGenerator()).toThrow(OvrmndError)
      expect(() => new AIConfigGenerator()).toThrow(
        'AI_TEMPERATURE must be a number between 0 and 1',
      )

      process.env['AI_TEMPERATURE'] = '2'
      expect(() => new AIConfigGenerator()).toThrow(
        'AI_TEMPERATURE must be a number between 0 and 1',
      )
    })

  })

  describe('generateConfig', () => {
    let generator: AIConfigGenerator
    let mockCreate: jest.Mock

    beforeEach(() => {
      mockCreate = jest.fn()
      ;(Anthropic as unknown as jest.Mock).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))
      generator = new AIConfigGenerator()
    })

    it('should generate valid config from AI response', async () => {
      const mockConfig = {
        serviceName: 'github',
        baseUrl: 'https://api.github.com',
        authentication: {
          type: 'bearer',
          token: '${GITHUB_TOKEN}',
        },
        endpoints: [
          {
            name: 'listRepos',
            method: 'GET',
            path: '/user/repos',
            cacheTTL: 300,
          },
          {
            name: 'createRepo',
            method: 'POST',
            path: '/user/repos',
          },
        ],
        aliases: [
          {
            name: 'my-repos',
            endpoint: 'listRepos',
            args: { type: 'owner' },
          },
        ],
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockConfig),
          },
        ],
      })

      const result = await generator.generateConfig(
        'github',
        'Create config for GitHub API repo management',
      )

      expect(result).toEqual(mockConfig)
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-haiku-20241022',
        temperature: 0,
        system: expect.stringContaining('GitHub API'),
        messages: [
          {
            role: 'user',
            content:
              'Generate the ServiceConfig JSON based on the requirements above.',
          },
        ],
        stream: false,
        max_tokens: 4096,
      })
    })

    it('should extract JSON from markdown response', async () => {
      const mockConfig = {
        serviceName: 'test',
        baseUrl: 'https://api.test.com',
        endpoints: [
          {
            name: 'list',
            method: 'GET',
            path: '/items',
          },
        ],
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `Here's the configuration:\n\`\`\`json\n${JSON.stringify(
              mockConfig,
            )}\n\`\`\`\n\nThis should work well!`,
          },
        ],
      })

      const result = await generator.generateConfig(
        'test',
        'Create a test config',
      )

      expect(result).toEqual(mockConfig)
    })

    it('should throw error if AI returns non-text content', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: 'abc',
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('AI did not return text content')
    })

    it('should throw error if no JSON found in response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is just plain text without any JSON',
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('No valid JSON found in AI response')
    })

    it('should throw error if JSON is invalid', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{ invalid json without quotes }',
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Failed to parse AI-generated JSON')
    })

    it('should throw error if config fails validation', async () => {
      const invalidConfig = {
        serviceName: 'test',
        // Missing required 'baseUrl' and 'endpoints'
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(invalidConfig),
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('AI-generated config failed validation')
    })

    it('should handle API errors gracefully', async () => {
      const apiError = Object.create(Anthropic.APIError.prototype)
      Object.assign(apiError, {
        status: 400,
        message: 'Invalid API key',
        type: 'invalid_request_error',
      })
      mockCreate.mockRejectedValue(apiError)

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('AI API error: Invalid API key')
    })

    it('should handle unknown errors', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'))

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Failed to generate config: Network error')
    })

    it('should use environment variables for model configuration', async () => {
      process.env['AI_MODEL'] = 'claude-3-opus-20240229'
      process.env['AI_MAX_TOKENS'] = '2000'
      process.env['AI_TEMPERATURE'] = '0.5'

      // Create new generator with env vars set
      generator = new AIConfigGenerator()

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              serviceName: 'test',
              baseUrl: 'https://api.test.com',
              endpoints: [
                {
                  name: 'list',
                  method: 'GET',
                  path: '/items',
                },
              ],
            }),
          },
        ],
      })

      await generator.generateConfig('test', 'Create config')

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0.5,
        system: expect.any(String),
        messages: expect.any(Array),
        stream: false,
      })
    })

    it('should include service name and prompt in system message', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              serviceName: 'shopify',
              baseUrl: 'https://api.shopify.com',
              endpoints: [
                {
                  name: 'listProducts',
                  method: 'GET',
                  path: '/products',
                },
              ],
            }),
          },
        ],
      })

      await generator.generateConfig(
        'shopify',
        'Find Shopify REST API docs for products',
      )

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-haiku-20241022',
        temperature: 0,
        system: expect.stringContaining('Service name: shopify'),
        messages: expect.any(Array),
        stream: false,
        max_tokens: 4096,
      })

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-haiku-20241022',
        temperature: 0,
        system: expect.stringContaining(
          'User request: Find Shopify REST API docs for products',
        ),
        messages: expect.any(Array),
        stream: false,
        max_tokens: 4096,
      })
    })

    it('should reject configs with HTTP base URLs', async () => {
      const insecureConfig = {
        serviceName: 'test',
        baseUrl: 'http://api.test.com', // HTTP instead of HTTPS
        endpoints: [
          {
            name: 'list',
            method: 'GET',
            path: '/items',
          },
        ],
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(insecureConfig),
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Base URL must use HTTPS for security')
    })

    it('should reject configs with hardcoded auth tokens', async () => {
      const badConfig = {
        serviceName: 'test',
        baseUrl: 'https://api.test.com',
        authentication: {
          type: 'bearer',
          token: 'sk-12345abcdef', // Hardcoded instead of ${ENV_VAR}
        },
        endpoints: [
          {
            name: 'list',
            method: 'GET',
            path: '/items',
          },
        ],
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(badConfig),
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Authentication token must use environment variable format')
    })

    it('should reject configs with hardcoded secrets in headers', async () => {
      const badConfig = {
        serviceName: 'test',
        baseUrl: 'https://api.test.com',
        endpoints: [
          {
            name: 'list',
            method: 'GET',
            path: '/items',
            headers: {
              'X-API-Key': 'secret-key-123', // Hardcoded secret
            },
          },
        ],
      }

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(badConfig),
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Potential hardcoded secret in endpoint "list" headers')
    })
  })
})
