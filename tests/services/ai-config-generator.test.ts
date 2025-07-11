import { AIConfigGenerator } from '../../src/services/ai-config-generator'
import { OvrmndError } from '../../src/utils/error'
import OpenAI from 'openai'

// Mock the OpenAI SDK
jest.mock('openai')

describe('AIConfigGenerator', () => {
  const mockApiKey = 'test-api-key'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('should throw error if API key is not set for default provider', () => {
      expect(() => new AIConfigGenerator()).toThrow(OvrmndError)
      expect(() => new AIConfigGenerator()).toThrow(
        'OPENAI_API_KEY required for OpenAI',
      )
    })

    it('should initialize client with OpenAI API key by default', () => {
      process.env['OPENAI_API_KEY'] = mockApiKey

      new AIConfigGenerator()

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        baseURL: 'https://api.openai.com/v1',
      })
    })

    it('should use Anthropic provider for backward compatibility', () => {
      process.env['ANTHROPIC_API_KEY'] = mockApiKey

      new AIConfigGenerator()

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        baseURL: 'https://api.anthropic.com/v1',
      })
    })

    it('should respect AI_PROVIDER environment variable', () => {
      process.env['AI_PROVIDER'] = 'google'
      process.env['GOOGLE_API_KEY'] = mockApiKey

      new AIConfigGenerator()

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        baseURL:
          'https://generativelanguage.googleapis.com/v1beta/openai',
      })
    })

    it('should throw error for invalid provider', () => {
      process.env['AI_PROVIDER'] = 'invalid'

      expect(() => new AIConfigGenerator()).toThrow(OvrmndError)
      expect(() => new AIConfigGenerator()).toThrow(
        'Invalid AI provider: invalid',
      )
    })

    it('should use custom model from environment variable', () => {
      process.env['OPENAI_API_KEY'] = mockApiKey
      process.env['AI_MODEL'] = 'gpt-4-turbo'

      new AIConfigGenerator()

      // Model should be set but we can't directly access private property
      // Will be tested in generateConfig tests
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        baseURL: 'https://api.openai.com/v1',
      })
    })

    it('should throw error for invalid AI_MAX_TOKENS', () => {
      process.env['OPENAI_API_KEY'] = mockApiKey
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
      process.env['OPENAI_API_KEY'] = mockApiKey
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
      process.env['OPENAI_API_KEY'] = mockApiKey
      mockCreate = jest.fn()
      ;(OpenAI as unknown as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
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
        choices: [
          {
            message: {
              content: JSON.stringify(mockConfig),
            },
          },
        ],
      })

      const result = await generator.generateConfig(
        'github',
        'Create config for GitHub API repo management',
      )

      expect(result).toEqual(mockConfig)
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: expect.stringContaining(
              '<service_name>github</service_name>',
            ),
          },
          {
            role: 'user',
            content:
              'Generate the ServiceConfig JSON based on the requirements above.',
          },
        ],
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
        choices: [
          {
            message: {
              content: `Here's the configuration:\n\`\`\`json\n${JSON.stringify(
                mockConfig,
              )}\n\`\`\`\n\nThis should work well!`,
            },
          },
        ],
      })

      const result = await generator.generateConfig(
        'test',
        'Create a test config',
      )

      expect(result).toEqual(mockConfig)
    })

    it('should throw error if AI returns no content', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('AI did not return any content')
    })

    it('should throw error if no JSON found in response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is just plain text without any JSON',
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('No valid JSON found in AI response')
    })

    it('should throw error if JSON is invalid', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{ invalid json without quotes }',
            },
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
        choices: [
          {
            message: {
              content: JSON.stringify(invalidConfig),
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('AI-generated config failed validation')
    })

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Invalid API key')
      apiError.constructor = { name: 'APIError' } as any
      ;(apiError as any).status = 401
      mockCreate.mockRejectedValue(apiError)

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('OpenAI API error: Invalid API key')
    })

    it('should handle unknown errors', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'))

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Failed to generate config: Network error')
    })

    it('should use environment variables for model configuration', async () => {
      process.env['AI_MODEL'] = 'gpt-4-turbo'
      process.env['AI_MAX_TOKENS'] = '2000'
      process.env['AI_TEMPERATURE'] = '0.5'

      // Create new generator with env vars set
      generator = new AIConfigGenerator()

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          },
        ],
      })

      await generator.generateConfig('test', 'Create config')

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4-turbo',
        max_tokens: 2000,
        temperature: 0.5,
        messages: expect.any(Array),
      })
    })

    it('should include service name and prompt in system message', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          },
        ],
      })

      await generator.generateConfig(
        'shopify',
        'Find Shopify REST API docs for products',
      )

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: expect.stringContaining(
              '<service_name>shopify</service_name>',
            ),
          },
          {
            role: 'user',
            content:
              'Generate the ServiceConfig JSON based on the requirements above.',
          },
        ],
      })

      // Also check for user request in the system prompt
      const systemMessage = mockCreate.mock.calls[0][0].messages[0]
      expect(systemMessage.content).toContain(
        '<user_request>Find Shopify REST API docs for products</user_request>',
      )
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
        choices: [
          {
            message: {
              content: JSON.stringify(insecureConfig),
            },
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
        choices: [
          {
            message: {
              content: JSON.stringify(badConfig),
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow(
        'Authentication token must use environment variable format',
      )
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
        choices: [
          {
            message: {
              content: JSON.stringify(badConfig),
            },
          },
        ],
      })

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow(
        'Potential hardcoded secret in endpoint "list" headers',
      )
    })

    it('should support debug mode', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation()

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          },
        ],
      })

      await generator.generateConfig('test', 'Create config', {
        debug: true,
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DEBUG] AI Configuration:',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '  Provider: OpenAI',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '  Base URL: https://api.openai.com/v1',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '  Model: gpt-4o-mini',
      )

      consoleErrorSpy.mockRestore()
    })

    it('should provide provider-specific error help', async () => {
      // Test OpenAI rate limit error
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.constructor = { name: 'APIError' } as any
      ;(rateLimitError as any).status = 429
      mockCreate.mockRejectedValue(rateLimitError)

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('OpenAI API error: Rate limit exceeded')

      // Test with Google provider
      process.env['AI_PROVIDER'] = 'google'
      process.env['GOOGLE_API_KEY'] = mockApiKey
      generator = new AIConfigGenerator()

      const googleError = new Error('Invalid key')
      googleError.constructor = { name: 'APIError' } as any
      ;(googleError as any).status = 401
      mockCreate.mockRejectedValue(googleError)

      await expect(
        generator.generateConfig('test', 'Create config'),
      ).rejects.toThrow('Google Gemini API error: Invalid key')
    })
  })
})
