import Anthropic from '@anthropic-ai/sdk'
import type { ServiceConfig } from '../types/config'
import { validateServiceConfig } from '../config/validator'
import { OvrmndError, ErrorCode } from '../utils/error'
import * as fs from 'fs/promises'
import * as path from 'path'

export class AIConfigGenerator {
  private client: Anthropic
  private systemPromptCache: string | null = null
  private model: string
  private maxTokens: number | undefined
  private temperature: number

  constructor() {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message:
          'ANTHROPIC_API_KEY environment variable is required for AI generation',
        help: 'Set your API key: export ANTHROPIC_API_KEY="your-api-key"',
      })
    }

    // Read configuration from environment variables
    this.model =
      process.env['AI_MODEL'] ?? 'claude-3-5-haiku-20241022'
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

    this.client = new Anthropic({ apiKey })
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    // Load the new XML-based prompt
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
  ): Promise<ServiceConfig> {
    // Load the system prompt template
    const promptTemplate = await this.loadSystemPrompt()

    // Replace placeholders with actual values
    const systemPrompt = promptTemplate
      .replace('{serviceName}', serviceName)
      .replace('{prompt}', prompt)

    try {
      // Use prompt caching for better performance and cost reduction
      const messageParams: Anthropic.MessageCreateParamsNonStreaming =
        {
          model: this.model,
          temperature: this.temperature,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              // Enable ephemeral caching for prompts > 1024 tokens
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [
            {
              role: 'user',
              content:
                'Generate the ServiceConfig JSON based on the requirements above.',
            },
          ],
          stream: false,
          max_tokens: this.maxTokens ?? 4096, // Default to 4096 if not specified
        }

      const response = (await this.client.messages.create(
        messageParams,
      )) as Anthropic.Message

      // Extract JSON from the response
      const content = response.content[0]
      if (!content || content.type !== 'text') {
        throw new OvrmndError({
          code: ErrorCode.CONFIG_INVALID,
          message: 'AI did not return text content',
        })
      }

      const configJson = this.extractJSON(content.text)
      return this.validateConfig(configJson)
    } catch (error) {
      if (error instanceof OvrmndError) {
        throw error
      }

      if (error instanceof Anthropic.APIError) {
        throw new OvrmndError({
          code: ErrorCode.API_REQUEST_FAILED,
          message: `AI API error: ${error.message}`,
          help: 'Check your API key and try again',
        })
      }

      throw new OvrmndError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: `Failed to generate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
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

    // Check for hardcoded secrets in headers
    for (const endpoint of config.endpoints) {
      if (endpoint.headers) {
        for (const [key, value] of Object.entries(endpoint.headers)) {
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
}
