# AI Proxy Configuration Plan

## Overview

This document outlines the implementation plan for migrating the AI configuration generator from the Anthropic SDK to the OpenAI SDK. This enables seamless support for both direct Anthropic API calls and proxy servers using a single SDK.

## Requirements

### Primary Goals
1. Replace Anthropic SDK with OpenAI SDK for all AI calls
2. Support configurable proxy URL for enterprise environments
3. Maintain exact same functionality as current implementation
4. Simple environment variable configuration

### Use Cases
- Direct Anthropic API calls (default)
- Enterprise users with corporate AI proxies
- Users with custom LLM gateways
- Development/testing with local proxy servers

## Technical Implementation

### 1. Dependencies

Update dependencies - remove Anthropic SDK, add OpenAI SDK:
```json
{
  "dependencies": {
    "openai": "^4.0.0"
    // Remove: "@anthropic-ai/sdk"
  }
}
```

### 2. Environment Variable Support

```bash
# Direct Anthropic API (default)
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# OR use a proxy
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx  # Optional, defaults to ANTHROPIC_API_KEY
```

### 3. AI Config Generator Updates

#### File: `src/services/ai-config-generator.ts`

Complete rewrite to use only OpenAI SDK:

```typescript
import OpenAI from 'openai'
import type { ServiceConfig } from '../types/config'
import { validateServiceConfig } from '../config/validator'
import { OvrmndError, ErrorCode } from '../utils/error'
import * as fs from 'fs/promises'
import * as path from 'path'

export class AIConfigGenerator {
  private client: OpenAI
  private systemPromptCache: string | null = null
  private model: string
  private maxTokens: number | undefined
  private temperature: number
  
  constructor() {
    const proxyUrl = process.env['AI_PROXY_URL']
    const proxyToken = process.env['AI_PROXY_TOKEN']
    const apiKey = proxyToken || process.env['ANTHROPIC_API_KEY']
    
    if (!apiKey) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: 'ANTHROPIC_API_KEY or AI_PROXY_TOKEN required for AI generation',
        help: 'Set your API key: export ANTHROPIC_API_KEY="your-api-key"',
      })
    }
    
    // Read configuration from environment variables
    this.model = process.env['AI_MODEL'] ?? 'claude-3-5-haiku-20241022'
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
    
    // Initialize OpenAI client with appropriate base URL
    this.client = new OpenAI({
      apiKey,
      baseURL: proxyUrl || 'https://api.anthropic.com/v1/',
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
          message: `AI API error: ${apiError.message}`,
          help: process.env['AI_PROXY_URL'] 
            ? 'Check your proxy URL and token' 
            : 'Check your API key and try again',
        })
      }
      
      throw new OvrmndError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: `Failed to generate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }
  
  private getModelName(): string {
    // For some proxies, the model might need "anthropic:" prefix
    const proxyUrl = process.env['AI_PROXY_URL']
    if (proxyUrl && !this.model.startsWith('anthropic:')) {
      return `anthropic:${this.model}`
    }
    return this.model
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
      'ai-config-prompt.md',
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
  
  // ... rest of existing methods (extractJSON, validateConfig, performSecurityValidation)
}
```

### 4. Debug Mode Enhancements

Add proxy information to debug output:

```typescript
// In generateConfig method
if (options.debug) {
  logger.debug('AI Configuration:', {
    baseURL: process.env['AI_PROXY_URL'] || 'https://api.anthropic.com/v1/',
    model: this.getModelName(),
    temperature: this.temperature,
    maxTokens: this.maxTokens ?? 4096,
  })
}
```

## Testing Strategy

### Unit Tests
- Mock OpenAI SDK client
- Test direct Anthropic API configuration
- Test proxy configuration
- Test model name prefixing for proxies
- Test error handling

### Integration Tests
```bash
# Test with proxy
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx
ovrmnd init github --prompt "Create GitHub API config"

# Test without proxy (direct Anthropic)
unset AI_PROXY_URL
unset AI_PROXY_TOKEN
export ANTHROPIC_API_KEY=sk-ant-xxxxx
ovrmnd init github --prompt "Create GitHub API config"
```

## Documentation Updates

### README.md
Add section on AI proxy configuration:

```markdown
### AI Proxy Configuration

The Ovrmnd CLI uses the OpenAI SDK for AI configuration generation, which supports both direct Anthropic API calls and proxy servers.

#### Direct Anthropic API (Default)
```bash
export ANTHROPIC_API_KEY=sk-ant-xxxxx
ovrmnd init myservice --prompt "Configure service for..."
```

#### Using a Proxy Server
```bash
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx  # Optional, defaults to ANTHROPIC_API_KEY
ovrmnd init myservice --prompt "Configure service for..."
```

The proxy must support OpenAI-compatible endpoints (`/v1/chat/completions`).
```

### Environment Variables
Document the new environment variables:

- `AI_PROXY_URL`: URL of the AI proxy server (e.g., https://proxy.shopify.ai)
- `AI_PROXY_TOKEN`: Authentication token for the proxy (defaults to ANTHROPIC_API_KEY)

## Implementation Notes

1. **Single SDK**: Uses only OpenAI SDK for all AI calls (simpler codebase)
2. **Backward Compatibility**: Existing ANTHROPIC_API_KEY continues to work
3. **Smart Base URL**: Defaults to Anthropic API, switches to proxy when configured
4. **Token Handling**: AI_PROXY_TOKEN is optional, falls back to ANTHROPIC_API_KEY
5. **Model Naming**: Proxy calls automatically prefix model with "anthropic:" if needed

## Security Considerations

1. Never log the proxy token in debug mode
2. Validate proxy URL format to prevent injection
3. Use HTTPS for proxy connections
4. Clear error messages that don't expose sensitive data