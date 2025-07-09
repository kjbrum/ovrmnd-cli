# AI-Powered Init Command Enhancement Plan

## Overview

This document outlines the plan to extend the `ovrmnd init` command with AI-powered configuration generation capabilities using the Claude Code SDK. This enhancement will allow users to describe an API in natural language and have Claude research and generate an appropriate YAML configuration automatically.

## Motivation

Currently, users must either:
1. Use interactive prompts to manually configure services
2. Use the basic REST template and modify it extensively

With AI generation, users can simply describe what they need:
- "Find the Shopify REST API documentation and create a config for the 5 most common endpoints"
- "Create a GitHub API config with repository and issue management endpoints"
- "Generate a Slack API configuration for sending messages and managing channels"

## Implementation Details

### 1. Dependencies

Add the Claude Code SDK to the project:
```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.0"
  }
}
```

### 2. Code Changes

#### Update InitArgs Interface (`src/commands/init.ts`)
```typescript
interface InitArgs {
  serviceName?: string
  template: 'rest'
  output?: string
  force: boolean
  global: boolean
  pretty: boolean
  debug: boolean
  prompt?: string  // NEW: AI generation prompt
}
```

#### Create AI Config Generator (`src/services/ai-config-generator.ts`)
```typescript
import { query } from '@anthropic-ai/claude-code'
import type { ServiceConfig } from '../types/config'

export class AIConfigGenerator {
  private apiKey: string

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for AI generation')
    }
    this.apiKey = apiKey
  }

  async generateConfig(serviceName: string, prompt: string): Promise<ServiceConfig> {
    const systemPrompt = `You are helping generate an Ovrmnd CLI configuration file for a REST API service.
    
    Based on the user's prompt, you should:
    1. Research the API documentation (via web search if needed)
    2. Identify the most important/common endpoints
    3. Determine the authentication method (bearer token, API key, or none)
    4. Generate a complete ServiceConfig object in JSON format
    
    The config should follow this TypeScript interface:
    interface ServiceConfig {
      serviceName: string
      baseUrl: string
      authentication?: {
        type: 'bearer' | 'apikey'
        token: string  // Use ${ENV_VAR_NAME} format
        header?: string  // For apikey type
      }
      endpoints: Array<{
        name: string
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
        path: string  // Use {param} for parameters
        cacheTTL?: number
        headers?: Record<string, string>
        defaultParams?: Record<string, unknown>
        transform?: {
          fields?: string[]
          rename?: Record<string, string>
        }
      }>
      aliases?: Array<{
        name: string
        endpoint: string
        args?: Record<string, unknown>
      }>
    }
    
    Service name: ${serviceName}
    User request: ${prompt}`

    const messages = []
    for await (const message of query({
      prompt: systemPrompt,
      options: { 
        maxTurns: 3,
        model: 'claude-3-opus-20240229'
      }
    })) {
      messages.push(message)
    }

    // Parse and validate the generated config
    const configJson = this.extractConfigFromResponse(messages)
    return this.validateConfig(configJson)
  }

  private extractConfigFromResponse(messages: any[]): any {
    // Extract JSON config from Claude's response
    // Implementation details...
  }

  private validateConfig(config: any): ServiceConfig {
    // Validate using Zod schema
    // Implementation details...
  }
}
```

#### Update Init Command Handler
```typescript
handler = async (args: ArgumentsCamelCase<InitArgs>): Promise<void> => {
  const formatter = new OutputFormatter(!args.pretty)

  try {
    let serviceInfo: ServiceInfo
    let template: ServiceConfig

    // Check if AI generation is requested (inferred from --prompt)
    if (args.prompt) {
      if (!args.serviceName) {
        throw new OvrmndError({
          code: ErrorCode.PARAM_REQUIRED,
          message: 'Service name is required when using --prompt',
          help: 'Provide service name: ovrmnd init <serviceName> --prompt "..."'
        })
      }

      // Show progress
      if (args.pretty) {
        process.stderr.write(formatter.info('🤖 Using AI to research and generate configuration...\\n'))
      }

      // Generate config using AI
      const generator = new AIConfigGenerator()
      template = await generator.generateConfig(args.serviceName, args.prompt)
      
      serviceInfo = {
        serviceName: template.serviceName,
        displayName: this.toDisplayName(template.serviceName),
        baseUrl: template.baseUrl,
        authType: template.authentication?.type ?? 'none',
        authHeader: template.authentication?.header,
        envVarName: this.extractEnvVarName(template.authentication?.token)
      }
    } else {
      // Existing interactive/template logic
      serviceInfo = await this.collectServiceInfo(args)
      template = this.generateTemplate(serviceInfo, args.template)
    }

    // Rest of the handler remains the same...
  }
}
```

### 3. CLI Examples

Update the command builder with new examples:
```typescript
.example(
  '$0 init shopify --prompt "Find Shopify REST API docs for products and orders"',
  'AI-powered Shopify config generation'
)
.example(
  '$0 init github --prompt "Create config for GitHub API repo management"',
  'AI-powered GitHub config generation'
)
```

### 4. Environment Configuration

Users will need to set up their Anthropic API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 5. Error Handling

- Check for `ANTHROPIC_API_KEY` when `--prompt` is used
- Handle API rate limits gracefully
- Validate AI-generated configs before writing
- Provide helpful error messages if generation fails

## Documentation Updates

### README.md
Add new section for AI-powered initialization:
```markdown
### AI-Powered Configuration Generation

Ovrmnd can use AI to research APIs and generate configurations automatically:

```bash
# Let AI research and create the config
ovrmnd init shopify --prompt "Find the Shopify REST API documentation and create a config for managing products, orders, and customers"

# AI will:
# 1. Research the Shopify API documentation
# 2. Identify authentication requirements
# 3. Find the relevant endpoints
# 4. Generate a complete configuration file

# Requirements:
# - Set ANTHROPIC_API_KEY environment variable
# - Provide both service name and --prompt
```
```

### CLAUDE.md
Document the AI generation feature for future Claude interactions.

### docs/phases/PROGRESS.md
Update Phase 5 progress to include AI enhancement as part of the init command implementation.

## Testing Strategy

1. **Unit Tests**
   - Mock the Claude Code SDK
   - Test prompt validation
   - Test config extraction and validation
   - Test error handling for missing API key

2. **Integration Tests**
   - Test with real API key (in CI with secrets)
   - Validate generated configs match schema
   - Test various prompt formats

## Security Considerations

- API key is read from environment only (never hardcoded)
- Generated configs are validated before writing
- Sensitive information in prompts is not logged

## Future Enhancements

1. **Caching**: Cache AI responses for similar prompts
2. **Templates**: Allow AI to use custom templates
3. **Refinement**: Interactive refinement of AI-generated configs
4. **Batch Generation**: Generate multiple service configs at once

## Implementation Timeline

This enhancement is planned as part of Phase 5 completion, after the basic init command is fully implemented and tested.