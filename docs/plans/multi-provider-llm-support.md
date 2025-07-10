# Multi-Provider LLM Support Plan

## Overview

This document outlines the implementation plan for adding support for multiple LLM providers (OpenAI, Anthropic, Google Gemini) to the Ovrmnd CLI's AI configuration generator. This feature uses the OpenAI SDK's compatibility layer to provide a unified interface across providers.

## Requirements

### Primary Goals
1. Support multiple LLM providers: OpenAI, Anthropic, and Google Gemini
2. Use OpenAI SDK as the unified interface for all providers
3. Simple environment variable configuration for provider selection
4. Maintain backward compatibility with existing ANTHROPIC_API_KEY setup
5. Provider-specific model and configuration handling

### Use Cases
- Users with OpenAI API access
- Existing Anthropic users (backward compatible)
- Users with Google Gemini API access
- Easy switching between providers without code changes

## Technical Implementation

### 1. Dependencies

Update to use only OpenAI SDK:
```json
{
  "dependencies": {
    "openai": "^4.0.0"
    // Remove: "@anthropic-ai/sdk"
  }
}
```

### 2. Environment Variable Configuration

```bash
# Provider selection (defaults to 'anthropic' for backward compatibility)
export AI_PROVIDER=openai|anthropic|google

# Provider-specific API keys
export OPENAI_API_KEY=sk-xxxxx        # For OpenAI
export ANTHROPIC_API_KEY=sk-ant-xxxxx # For Anthropic
export GOOGLE_API_KEY=xxxxx           # For Google Gemini

# Optional: Override default model for provider
export AI_MODEL=gpt-4.1-nano          # OpenAI model
export AI_MODEL=claude-3-5-haiku-20241022  # Anthropic model
export AI_MODEL=gemini-2.5-flash-lite-preview-06-17     # Google model

# Optional: Model configuration
export AI_MAX_TOKENS=4000
export AI_TEMPERATURE=0
```

### 3. Provider Configuration

#### File: `src/types/ai-provider.ts`
```typescript
export interface AIProviderConfig {
  name: string
  baseURL: string
  apiKeyEnvVar: string
  defaultModel: string
  modelPrefix?: string
}

export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1/',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4.1-nano',
  },
  anthropic: {
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1/',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  google: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.5-flash-lite-preview-06-17',
  },
}
```

### 4. AI Config Generator Updates

#### File: `src/services/ai-config-generator.ts`

```typescript
import OpenAI from 'openai'
import { AI_PROVIDERS, AIProviderConfig } from '../types/ai-provider'
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

  constructor() {
    // Determine provider (default to 'openai')
    const providerName = process.env['AI_PROVIDER'] || 'openai'
    const provider = AI_PROVIDERS[providerName]

    if (!provider) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Invalid AI provider: ${providerName}`,
        help: 'Valid providers are: openai, anthropic, google',
      })
    }

    this.provider = provider

    // Get API key for the selected provider
    const apiKey = process.env[provider.apiKeyEnvVar]

    if (!apiKey) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `${provider.apiKeyEnvVar} required for ${provider.name}`,
        help: `Set your API key: export ${provider.apiKeyEnvVar}="your-api-key"`,
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

    // Initialize OpenAI client with provider-specific configuration
    this.client = new OpenAI({
      apiKey,
      baseURL: provider.baseURL,
    })
  }

  async generateConfig(
    serviceName: string,
    prompt: string,
  ): Promise<ServiceConfig> {
    // Load and prepare the system prompt
    const promptTemplate = await this.loadSystemPrompt()
    const systemPrompt = promptTemplate
      .replace('{serviceName}', serviceName)
      .replace('{prompt}', prompt)

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens ?? 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: 'Generate the ServiceConfig JSON based on the requirements above.',
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
      if (error instanceof Error && error.constructor.name === 'APIError') {
        const apiError = error as any
        throw new OvrmndError({
          code: ErrorCode.API_REQUEST_FAILED,
          message: `${this.provider.name} API error: ${apiError.message}`,
          help: this.getProviderSpecificHelp(apiError),
        })
      }

      throw new OvrmndError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: `Failed to generate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  private getProviderSpecificHelp(error: any): string {
    const statusCode = error.status || error.statusCode

    switch (this.provider.name) {
      case 'OpenAI':
        if (statusCode === 401) return 'Check your OpenAI API key'
        if (statusCode === 429) return 'OpenAI rate limit exceeded. Please wait and try again'
        return 'Check your OpenAI API key and account status'

      case 'Anthropic':
        if (statusCode === 401) return 'Check your Anthropic API key'
        if (statusCode === 429) return 'Anthropic rate limit exceeded. Please wait and try again'
        return 'Check your Anthropic API key and account status'

      case 'Google Gemini':
        if (statusCode === 401) return 'Check your Google API key'
        if (statusCode === 429) return 'Google API quota exceeded. Please wait and try again'
        return 'Check your Google API key and ensure Gemini API is enabled'

      default:
        return 'Check your API configuration and try again'
    }
  }

  // ... rest of existing methods (loadSystemPrompt, extractJSON, validateConfig, performSecurityValidation)
}
```

### 5. Debug Mode Enhancements

Add provider information to debug output:

```typescript
// In generateConfig method
if (options.debug) {
  logger.debug('AI Configuration:', {
    provider: this.provider.name,
    baseURL: this.provider.baseURL,
    model: this.model,
    temperature: this.temperature,
    maxTokens: this.maxTokens ?? 4096,
  })
}
```

## Provider-Specific Considerations

### OpenAI
- Native support (no compatibility layer needed)
- Full feature set available
- Models: gpt-4.1-nano, gpt-4o, gpt-3.5-turbo

### Anthropic
- Uses OpenAI compatibility endpoint
- Some features not available (audio, prompt caching)
- System messages are concatenated to the beginning
- Models: claude-3-5-sonnet, claude-3-5-haiku, claude-4-opus

### Google Gemini
- Beta support via OpenAI compatibility
- Supports most OpenAI features
- Models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite-preview-06-17

## Testing Strategy

### Unit Tests
- Mock OpenAI SDK client
- Test provider selection logic
- Test API key validation for each provider
- Test error handling for each provider
- Test default provider (Anthropic) for backward compatibility

### Integration Tests
```bash
# Test with OpenAI
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-xxxxx
ovrmnd init github --prompt "Create GitHub API config"

# Test with Anthropic (default)
unset AI_PROVIDER  # or export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxxxx
ovrmnd init github --prompt "Create GitHub API config"

# Test with Google Gemini
export AI_PROVIDER=google
export GOOGLE_API_KEY=xxxxx
ovrmnd init github --prompt "Create GitHub API config"
```

## Documentation Updates

### README.md
Add section on multi-provider support:

```markdown
### AI Provider Configuration

Ovrmnd CLI supports multiple LLM providers for AI-powered configuration generation:

#### Supported Providers
- **OpenAI** - GPT-4, GPT-3.5 models
- **Anthropic** - Claude models (default for backward compatibility)
- **Google Gemini** - Gemini models

#### Configuration
```bash
# Select provider (defaults to 'anthropic')
export AI_PROVIDER=openai|anthropic|google

# Set API key for your chosen provider
export OPENAI_API_KEY=sk-xxxxx        # For OpenAI
export ANTHROPIC_API_KEY=sk-ant-xxxxx # For Anthropic
export GOOGLE_API_KEY=xxxxx           # For Google

# Optional: Override default model
export AI_MODEL=gpt-4.1-nano  # or claude-3-5-haiku-20241022, gemini-2.5-flash-lite-preview-06-17

# Generate configuration
ovrmnd init myservice --prompt "Configure service for..."
```

#### Provider Comparison
| Provider | Models | Default Model | Notes |
|----------|--------|--------------|-------|
| OpenAI | gpt-4o, gpt-4.1-nano, gpt-4-turbo, gpt-3.5-turbo | gpt-4.1-nano | Default provider, full feature support |
| Anthropic | claude-opus-4-0, claude-sonnet-4-0, claude-3-5-haiku-20241022 | claude-3-5-haiku-20241022 | Fast and cost-efficient |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite | gemini-2.5-flash-lite-preview-06-17 | Most cost-efficient |
```

## Migration Path

1. **Phase 1**: Install OpenAI SDK, remove Anthropic SDK
2. **Phase 2**: Implement provider abstraction and configuration
3. **Phase 3**: Update AI config generator to use provider system
4. **Phase 4**: Add provider-specific error handling
5. **Phase 5**: Update tests and documentation

## Design Decisions

### Default Provider Choice
We chose OpenAI as the default provider because:
1. Native SDK support (no compatibility layer needed)
2. Most widely adopted in the developer community
3. Full feature set without limitations
4. Stable and well-documented API

### Default Model Selection
We chose the fastest/most cost-efficient model for each provider as defaults:
- **OpenAI**: `gpt-4.1-nano` - Fastest and most affordable GPT-4 class model
- **Anthropic**: `claude-3-5-haiku-20241022` - Fast, cost-efficient with good performance
- **Google**: `gemini-2.5-flash-lite-preview-06-17` - Most cost-efficient Gemini model

This ensures users get good performance at minimal cost by default, while still allowing them to upgrade to more powerful models via the `AI_MODEL` environment variable.

## Future Enhancements

- Add support for Azure OpenAI
- Add support for local LLMs (Ollama, etc.)
- Provider-specific feature flags
- Automatic provider fallback on errors
- Provider usage statistics

## Security Considerations

1. Never log API keys in debug mode
2. Validate provider names to prevent injection
3. Use HTTPS for all API calls
4. Provider-specific rate limit handling
5. Clear error messages without exposing keys
