import OpenAI from 'openai'
import {
  AI_PROVIDERS,
  type AIProviderConfig,
} from '../types/ai-provider'
import type { ServiceConfig } from '../types/config'
import { validateServiceConfig } from '../config/validator'
import { OvrmndError, ErrorCode } from '../utils/error'
import * as fs from 'fs/promises'
import * as path from 'path'

export class AIConfigGenerator {
  private client: OpenAI
  private provider: AIProviderConfig
  private systemPromptCache: string | null = null
  private model: string
  private maxTokens: number | undefined
  private temperature: number
  private usingProxy: boolean = false

  constructor() {
    // Determine provider (default to openai)
    const providerName = process.env['AI_PROVIDER'] ?? 'openai'
    const provider = AI_PROVIDERS[providerName]

    if (!provider) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Invalid AI provider: ${providerName}`,
        help: 'Valid providers are: openai, anthropic, google',
      })
    }

    this.provider = provider

    // Check for proxy configuration first
    const proxyUrl = process.env['AI_PROXY_URL']
    const proxyToken = process.env['AI_PROXY_TOKEN']

    // Get API key for the selected provider
    const apiKey = process.env[provider.apiKeyEnvVar]

    // If using proxy with token, API key is optional
    if (!apiKey && !(proxyUrl && proxyToken)) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `${provider.apiKeyEnvVar} required for ${provider.name}`,
        help: proxyUrl
          ? `Set your API key or AI_PROXY_TOKEN: export ${provider.apiKeyEnvVar}="your-api-key" or export AI_PROXY_TOKEN="your-proxy-token"`
          : `Set your API key: export ${provider.apiKeyEnvVar}="your-api-key"`,
      })
    }

    // Read model configuration
    this.model = process.env['AI_MODEL'] ?? provider.defaultModel
    this.maxTokens = process.env['AI_MAX_TOKENS']
      ? parseInt(process.env['AI_MAX_TOKENS'], 10)
      : undefined
    this.temperature = process.env['AI_TEMPERATURE']
      ? parseFloat(process.env['AI_TEMPERATURE'])
      : 0

    // Validate configuration
    if (
      this.maxTokens !== undefined &&
      (isNaN(this.maxTokens) || this.maxTokens <= 0)
    ) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'AI_MAX_TOKENS must be a positive integer',
        help: 'Set a valid value: export AI_MAX_TOKENS="4000"',
      })
    }

    if (
      isNaN(this.temperature) ||
      this.temperature < 0 ||
      this.temperature > 1
    ) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'AI_TEMPERATURE must be a number between 0 and 1',
        help: 'Set a valid value: export AI_TEMPERATURE="0"',
      })
    }

    if (proxyUrl) {
      this.usingProxy = true
      // Override the provider's base URL with proxy URL
      const effectiveApiKey = proxyToken ?? apiKey ?? 'dummy-key' // Use proxy token if provided, fallback to API key or dummy

      this.client = new OpenAI({
        apiKey: effectiveApiKey,
        baseURL: proxyUrl,
      })

      // Log proxy configuration in debug mode
      if (process.env['DEBUG']) {
        console.error(`[DEBUG] Using AI proxy: ${proxyUrl}`)
      }
    } else {
      // Use provider's default configuration
      this.client = new OpenAI({
        apiKey: apiKey!,
        baseURL: provider.baseURL,
      })
    }
  }

  private getModelName(): string {
    // When using proxy, some providers need special prefixes
    if (this.usingProxy && this.provider.modelPrefix) {
      return `${this.provider.modelPrefix}${this.model}`
    }
    return this.model
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    // Load the XML-based prompt
    const promptPath = path.join(
      __dirname,
      '..',
      '..',
      'docs',
      'prompts',
      'ai-config-base.xml',
    )

    try {
      const content = await fs.readFile(promptPath, 'utf-8')
      this.systemPromptCache = content
      return content
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.FILE_ERROR,
        message: 'Failed to load AI configuration prompt',
        details: `Could not read prompt file at ${promptPath}`,
        help: 'This is likely an installation issue. Please reinstall the package.',
      })
    }
  }

  async generateConfig(
    serviceName: string,
    prompt: string,
    options?: {
      debug?: boolean
      apiType?: 'auto' | 'rest' | 'graphql'
    },
  ): Promise<ServiceConfig> {
    // Load the system prompt template
    const promptTemplate = await this.loadSystemPrompt()

    // Replace placeholders with actual values
    let systemPrompt = promptTemplate
      .replace('{serviceName}', serviceName)
      .replace('{prompt}', prompt)

    // Add API type preference if specified
    if (options?.apiType && options.apiType !== 'auto') {
      const apiTypeInstruction = `\n\n<api_type_preference>The user has specifically requested a ${options.apiType.toUpperCase()} API configuration. Only generate a ${options.apiType} configuration, even if the service supports other API types.</api_type_preference>`
      systemPrompt += apiTypeInstruction
    } else if (options?.apiType === 'auto' || !options?.apiType) {
      const apiTypeInstruction = `\n\n<api_type_preference>Auto-detect the best API type for this service. If the service supports GraphQL, prefer it over REST for better performance and flexibility. If GraphQL is not available or well-documented, use REST.</api_type_preference>`
      systemPrompt += apiTypeInstruction
    }

    // Log debug info if requested
    if (options?.debug) {
      console.error('[DEBUG] AI Configuration:')
      console.error(`  Provider: ${this.provider.name}`)
      console.error(`  Using Proxy: ${this.usingProxy}`)
      console.error(
        `  Base URL: ${this.usingProxy ? process.env['AI_PROXY_URL'] : this.provider.baseURL}`,
      )
      console.error(`  Model: ${this.getModelName()}`)
      console.error(`  Temperature: ${this.temperature}`)
      console.error(`  Max Tokens: ${this.maxTokens ?? 4096}`)
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.getModelName(),
        temperature: this.temperature,
        max_tokens: this.maxTokens ?? 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content:
              'Generate the ServiceConfig JSON based on the requirements above.',
          },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new OvrmndError({
          code: ErrorCode.CONFIG_INVALID,
          message: 'AI did not return any content',
        })
      }

      const configJson = this.extractJSON(content)
      return this.validateConfig(configJson)
    } catch (error) {
      if (error instanceof OvrmndError) {
        throw error
      }

      // Handle OpenAI SDK errors
      if (
        error instanceof Error &&
        error.constructor.name === 'APIError'
      ) {
        const apiError = error as Error & {
          status?: number
          statusCode?: number
        }
        throw new OvrmndError({
          code: ErrorCode.API_REQUEST_FAILED,
          message: `${this.usingProxy ? 'Proxy' : this.provider.name} API error: ${apiError.message}`,
          help: this.getProviderSpecificHelp(apiError),
        })
      }

      // Check for common connection errors
      if (error instanceof Error) {
        if (
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNREFUSED')
        ) {
          throw new OvrmndError({
            code: ErrorCode.API_REQUEST_FAILED,
            message: `Failed to connect to ${this.usingProxy ? 'proxy' : 'API'}: ${error.message}`,
            help: this.usingProxy
              ? 'Check that your proxy URL is correct and accessible'
              : 'Check your internet connection and API endpoint',
          })
        }
      }

      throw new OvrmndError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: `Failed to generate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  private getProviderSpecificHelp(error: {
    status?: number
    statusCode?: number
  }): string {
    const statusCode = error.status ?? error.statusCode

    if (this.usingProxy) {
      if (statusCode === 401)
        return 'Check your AI_PROXY_TOKEN or proxy authentication'
      if (statusCode === 404)
        return 'Proxy URL may be incorrect or endpoint not found'
      if (statusCode === 502)
        return 'Proxy server error - check if proxy is running'
      return 'Check your proxy configuration (AI_PROXY_URL and AI_PROXY_TOKEN)'
    }

    switch (this.provider.name) {
      case 'OpenAI':
        if (statusCode === 401) return 'Check your OpenAI API key'
        if (statusCode === 429)
          return 'OpenAI rate limit exceeded. Please wait and try again'
        return 'Check your OpenAI API key and account status'

      case 'Anthropic':
        if (statusCode === 401) return 'Check your Anthropic API key'
        if (statusCode === 429)
          return 'Anthropic rate limit exceeded. Please wait and try again'
        return 'Check your Anthropic API key and account status'

      case 'Google Gemini':
        if (statusCode === 401) return 'Check your Google API key'
        if (statusCode === 429)
          return 'Google API quota exceeded. Please wait and try again'
        return 'Check your Google API key and ensure Gemini API is enabled'

      default:
        return 'Check your API configuration and try again'
    }
  }

  private extractJSON(text: string): unknown {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'No valid JSON found in AI response',
      })
    }

    try {
      return JSON.parse(jsonMatch[0])
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'Failed to parse AI-generated JSON',
        details: error instanceof Error ? error.message : undefined,
      })
    }
  }

  private validateConfig(config: unknown): ServiceConfig {
    try {
      // Use the existing service config validation
      const validatedConfig = validateServiceConfig(
        config,
        'AI-generated',
      )

      // Additional security validation
      this.performSecurityValidation(validatedConfig)

      return validatedConfig
    } catch (error) {
      if (
        error instanceof OvrmndError &&
        error.code === ErrorCode.CONFIG_VALIDATION_ERROR
      ) {
        throw new OvrmndError({
          code: ErrorCode.CONFIG_INVALID,
          message: 'AI-generated config failed validation',
          details: error.message,
          help: 'The AI response did not match the expected schema. Try rephrasing your prompt.',
        })
      }
      throw error
    }
  }

  private performSecurityValidation(config: ServiceConfig): void {
    // Validate baseUrl uses HTTPS
    if (!config.baseUrl.startsWith('https://')) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'Base URL must use HTTPS for security',
        details: `Found: ${config.baseUrl}`,
        help: 'Update the base URL to use https:// instead of http://',
      })
    }

    // Validate authentication token format
    if (config.authentication?.token) {
      const envVarPattern = /^\$\{[A-Z_][A-Z0-9_]*\}$/
      if (!envVarPattern.test(config.authentication.token)) {
        throw new OvrmndError({
          code: ErrorCode.CONFIG_INVALID,
          message:
            'Authentication token must use environment variable format',
          details: `Found: ${config.authentication.token}`,
          help: 'Use format like ${API_KEY} or ${GITHUB_TOKEN}',
        })
      }
    }

    // Check for hardcoded secrets in REST endpoint headers
    if (config.endpoints) {
      for (const endpoint of config.endpoints) {
        if (endpoint.headers) {
          for (const [key, value] of Object.entries(
            endpoint.headers,
          )) {
            if (
              key.toLowerCase().includes('auth') ||
              key.toLowerCase().includes('key') ||
              key.toLowerCase().includes('token')
            ) {
              if (!value.includes('${')) {
                throw new OvrmndError({
                  code: ErrorCode.CONFIG_INVALID,
                  message: `Potential hardcoded secret in endpoint "${endpoint.name}" headers`,
                  details: `Header "${key}" appears to contain a hardcoded value`,
                  help: 'Use environment variables for sensitive headers',
                })
              }
            }
          }
        }
      }
    }

    // For GraphQL, validate operation syntax (basic check)
    if (config.apiType === 'graphql' && config.graphqlOperations) {
      for (const operation of config.graphqlOperations) {
        if (!operation.query.trim()) {
          throw new OvrmndError({
            code: ErrorCode.CONFIG_INVALID,
            message: `Empty GraphQL query in operation "${operation.name}"`,
            help: 'Provide a valid GraphQL query or mutation',
          })
        }
        // Basic syntax check - should contain query or mutation keyword
        if (!operation.query.match(/^\s*(query|mutation)\s+/i)) {
          throw new OvrmndError({
            code: ErrorCode.CONFIG_INVALID,
            message: `Invalid GraphQL syntax in operation "${operation.name}"`,
            details:
              'Query must start with "query" or "mutation" keyword',
            help: 'Use proper GraphQL syntax: query OperationName { ... }',
          })
        }
      }
    }
  }
}
