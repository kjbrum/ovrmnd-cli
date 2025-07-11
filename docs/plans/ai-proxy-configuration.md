# AI Proxy Configuration Plan

## Overview

This document outlines the implementation plan for adding proxy support to the multi-provider LLM system. Building on Phase 6's provider abstraction, this feature enables AI calls through corporate proxy servers for any configured provider.

## Requirements

### Primary Goals
1. Add proxy URL support to the existing provider system
2. Support enterprise environments with corporate AI proxies
3. Work seamlessly with any configured provider (OpenAI, Anthropic, Google)
4. Simple environment variable configuration

### Use Cases
- Enterprise users with corporate AI proxies
- Development/testing with local proxy servers
- Custom LLM gateways (e.g., proxy.shopify.ai)
- Provider-agnostic proxy configuration

## Technical Implementation

### 1. Prerequisites

This phase builds on Phase 6, which has already:
- Migrated to OpenAI SDK
- Implemented provider abstraction
- Removed Anthropic SDK dependency

### 2. Environment Variable Support

```bash
# Select your provider (from Phase 6)
export AI_PROVIDER=openai|anthropic|google
export OPENAI_API_KEY=sk-xxxxx        # or ANTHROPIC_API_KEY, GOOGLE_API_KEY

# Add proxy configuration (Phase 7)
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx  # Optional, defaults to provider's API key
```

### 3. AI Config Generator Updates

#### File: `src/services/ai-config-generator.ts`

Update the existing provider-based implementation to support proxy URLs:

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
  private usingProxy: boolean = false
  
  constructor() {
    // ... existing provider selection logic from Phase 6 ...
    
    // Check for proxy configuration
    const proxyUrl = process.env['AI_PROXY_URL']
    const proxyToken = process.env['AI_PROXY_TOKEN']
    
    if (proxyUrl) {
      this.usingProxy = true
      // Override the provider's base URL with proxy URL
      const effectiveApiKey = proxyToken || apiKey // Use proxy token if provided
      
      this.client = new OpenAI({
        apiKey: effectiveApiKey,
        baseURL: proxyUrl,
      })
      
      // Log proxy configuration in debug mode
      if (process.env['DEBUG']) {
        console.error(`Using AI proxy: ${proxyUrl}`)
      }
    } else {
      // Use provider's default configuration
      this.client = new OpenAI({
        apiKey,
        baseURL: this.provider.baseURL,
      })
    }
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
  
  // Update error handling to show proxy-specific messages
  private getProviderSpecificHelp(error: any): string {
    if (this.usingProxy) {
      const statusCode = error.status || error.statusCode
      if (statusCode === 401) return 'Check your AI_PROXY_TOKEN or proxy authentication'
      if (statusCode === 404) return 'Proxy URL may be incorrect or endpoint not found'
      if (statusCode === 502) return 'Proxy server error - check if proxy is running'
      return 'Check your proxy configuration (AI_PROXY_URL and AI_PROXY_TOKEN)'
    }
    
    // ... existing provider-specific error messages ...
  }
}
```

### 4. Debug Mode Enhancements

Update debug output to show proxy status:

```typescript
// In generateConfig method
if (options.debug) {
  logger.debug('AI Configuration:', {
    provider: this.provider.name,
    usingProxy: this.usingProxy,
    baseURL: this.usingProxy ? process.env['AI_PROXY_URL'] : this.provider.baseURL,
    model: this.getModelName(),
    temperature: this.temperature,
    maxTokens: this.maxTokens ?? 4096,
  })
}
```

## Testing Strategy

### Unit Tests
- Mock OpenAI SDK client
- Test proxy override for each provider
- Test proxy token vs provider API key logic
- Test model name prefixing with proxy
- Test proxy-specific error handling

### Integration Tests
```bash
# Test OpenAI with proxy
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-xxxxx
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx
ovrmnd init github --prompt "Create GitHub API config"

# Test Anthropic with proxy
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxxxx
export AI_PROXY_URL=https://proxy.shopify.ai
ovrmnd init github --prompt "Create GitHub API config"

# Test Google without proxy (direct)
unset AI_PROXY_URL
unset AI_PROXY_TOKEN
export AI_PROVIDER=google
export GOOGLE_API_KEY=xxxxx
ovrmnd init github --prompt "Create GitHub API config"
```

## Documentation Updates

### README.md
Add section on AI proxy configuration:

```markdown
### AI Proxy Configuration

The Ovrmnd CLI supports using proxy servers for AI calls with any configured provider.

#### Using a Proxy Server
```bash
# First, configure your provider (see Multi-Provider section)
export AI_PROVIDER=openai
export OPENAI_API_KEY=sk-xxxxx

# Then add proxy configuration
export AI_PROXY_URL=https://proxy.shopify.ai
export AI_PROXY_TOKEN=shopify-xxxxx  # Optional, defaults to provider's API key

# Generate configuration through proxy
ovrmnd init myservice --prompt "Configure service for..."
```

#### Proxy Requirements
- Must support OpenAI-compatible endpoints (`/v1/chat/completions`)
- Works with any configured provider (OpenAI, Anthropic, Google)
- Optional proxy-specific authentication token
```

### Environment Variables
Document the proxy-specific environment variables:

- `AI_PROXY_URL`: URL of the AI proxy server (e.g., https://proxy.shopify.ai)
- `AI_PROXY_TOKEN`: Authentication token for the proxy (defaults to provider's API key)

## Implementation Notes

1. **Builds on Phase 6**: Requires provider abstraction from multi-provider support
2. **Provider Agnostic**: Proxy works with any configured provider
3. **Base URL Override**: Proxy URL replaces provider's base URL when configured
4. **Token Handling**: AI_PROXY_TOKEN is optional, falls back to provider's API key
5. **Model Naming**: Proxy calls may need provider-specific prefixes

## Security Considerations

1. Never log the proxy token in debug mode
2. Validate proxy URL format to prevent injection
3. Use HTTPS for proxy connections
4. Clear error messages that don't expose sensitive data