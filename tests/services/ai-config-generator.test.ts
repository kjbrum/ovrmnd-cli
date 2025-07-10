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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0,
        system: expect.stringContaining('GitHub API'),
        messages: [
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0,
        system: expect.stringContaining('Service name: shopify'),
        messages: expect.any(Array),
      })

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0,
        system: expect.stringContaining(
          'User request: Find Shopify REST API docs for products',
        ),
        messages: expect.any(Array),
      })
    })
  })
})
