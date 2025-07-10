import Anthropic from '@anthropic-ai/sdk'
import type { ServiceConfig } from '../types/config'
import { validateServiceConfig } from '../config/validator'
import { OvrmndError, ErrorCode } from '../utils/error'
import * as fs from 'fs/promises'
import * as path from 'path'

export class AIConfigGenerator {
  private client: Anthropic
  private systemPromptCache: string | null = null

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

    this.client = new Anthropic({ apiKey })
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    const promptPath = path.join(
      __dirname,
      '..',
      '..',
      'docs',
      'ai-config-prompt.md'
    )
    
    try {
      const content = await fs.readFile(promptPath, 'utf-8')
      
      // Skip the markdown title and get the prompt content
      const lines = content.split('\n')
      const promptContent = lines.slice(2).join('\n').trim()
      
      this.systemPromptCache = promptContent
      return promptContent
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
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content:
              'Generate the ServiceConfig JSON based on the requirements above.',
          },
        ],
      })

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
      return validateServiceConfig(config, 'AI-generated')
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
}
