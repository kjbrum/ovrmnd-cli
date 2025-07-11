# Ovrmnd CLI

**Status:** Under Development

## Vision

Ovrmnd CLI is a universal, lightweight command-line interface (CLI) designed to be a simple bridge between Large Language Models (LLMs) and any REST API. The goal is to empower LLMs and AI agents to interact with the digital world through APIs without requiring custom-built, service-specific servers or complex integrations.

## Core Features

*   **Declarative YAML Configuration:** Define API endpoints, parameters, and authentication in simple, shareable YAML files.
*   **Automatic Service Discovery:** The CLI automatically discovers API configurations from global and project-specific directories.
*   **Secure by Default:** Credentials are kept out of configuration and sourced from environment variables (`.env` files supported).
*   **LLM-Friendly Output:** Provides structured JSON output for easy parsing by AI agents.
*   **Built-in Caching:** Reduce redundant API calls with configurable caching for GET requests.
*   **Aliases:** Create simple shortcuts for complex or frequently used API calls.
*   **AI-Powered Configuration:** Generate configurations automatically using natural language prompts (powered by Claude).

## Getting Started

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run in development mode:
```bash
npm run dev
```

### Testing

```bash
npm test
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run TypeScript compiler in watch mode
- `npm test` - Run tests
- `npm run lint` - Lint the codebase
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
src/
├── commands/       # CLI commands
├── config/         # Configuration management
├── api/           # API client implementation
├── cache/         # Response caching
├── transform/     # Response transformation
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
```

## Available Commands

### `ovrmnd call`
Execute API endpoints defined in your YAML configurations.

```bash
# Call an endpoint
ovrmnd call service.endpoint [parameters...]

# Examples
ovrmnd call github.listRepos
ovrmnd call github.getUser username=octocat
ovrmnd call api.createItem name="New Item" --pretty

# Batch operations
ovrmnd call github.getUser --batch-json='[{"username":"user1"},{"username":"user2"}]'
```

### `ovrmnd init`
Initialize a new service configuration with interactive prompts or AI assistance.

```bash
# Interactive mode
ovrmnd init github --interactive

# Basic template
ovrmnd init myapi

# AI-powered generation (requires API key for chosen provider)
ovrmnd init shopify --prompt "Find Shopify REST API docs for products and orders"
ovrmnd init github --prompt "Create config for GitHub API repo management"

# Options
--template=rest     # Template type (default: rest)
--global           # Create in global config directory (~/.ovrmnd)
--force            # Overwrite existing files
--output=path      # Custom output path
```

### `ovrmnd list`
List configured services, endpoints, and aliases.

```bash
# List all services
ovrmnd list services

# List endpoints for a service
ovrmnd list endpoints github

# List aliases for a service
ovrmnd list aliases github
```

### `ovrmnd validate`
Validate YAML configuration files.

```bash
# Validate all configurations
ovrmnd validate

# Validate specific service
ovrmnd validate github

# Validate specific file
ovrmnd validate --file path/to/config.yaml

# Strict mode (treat warnings as errors)
ovrmnd validate --strict
```

### `ovrmnd cache`
Manage the response cache.

```bash
# Clear all cache
ovrmnd cache clear

# Clear cache for specific service
ovrmnd cache clear github

# View cache statistics
ovrmnd cache stats

# List cached entries
ovrmnd cache list
ovrmnd cache list github --verbose
```

## AI-Powered Configuration Generation

Ovrmnd can use AI to research APIs and generate configurations automatically. It supports multiple LLM providers including OpenAI, Anthropic (Claude), and Google Gemini.

### Quick Start

```bash
# Using OpenAI (default)
export OPENAI_API_KEY="sk-..."
ovrmnd init shopify --prompt "Create config for Shopify REST API"

# Using Anthropic
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
ovrmnd init github --prompt "Create GitHub API config"

# Using Google Gemini
export AI_PROVIDER=google
export GOOGLE_API_KEY="..."
ovrmnd init stripe --prompt "Create Stripe payment API config"
```

### Provider Configuration

Ovrmnd supports multiple AI providers with a unified interface:

| Provider | Environment Variables | Default Model | Notes |
|----------|---------------------|---------------|-------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` | Default provider, fast and cost-effective |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-20241022` | Excellent for API research |
| Google | `GOOGLE_API_KEY` | `gemini-2.0-flash-exp` | Most cost-efficient option |

#### Setting the Provider

```bash
# Option 1: Set the AI_PROVIDER environment variable
export AI_PROVIDER=openai    # or anthropic, google

# Option 2: Backward compatibility - if ANTHROPIC_API_KEY is set but AI_PROVIDER is not, Anthropic will be used
export ANTHROPIC_API_KEY="your-key"  # Automatically uses Anthropic provider
```

#### Advanced Configuration

You can customize the AI behavior using these environment variables:

- `AI_MODEL` - Override the default model for your chosen provider
- `AI_MAX_TOKENS` - Set max response tokens (default: 4096)
- `AI_TEMPERATURE` - Set creativity level 0-1 (default: `0` for consistent output)

Examples:
```bash
# OpenAI with GPT-4
export AI_PROVIDER=openai
export OPENAI_API_KEY="sk-..."
export AI_MODEL="gpt-4-turbo"

# Anthropic with Claude Opus
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
export AI_MODEL="claude-3-5-sonnet-20241022"

# Google with Gemini Pro
export AI_PROVIDER=google
export GOOGLE_API_KEY="..."
export AI_MODEL="gemini-1.5-pro"
```

#### AI Proxy Configuration

Ovrmnd supports using proxy servers for AI calls, enabling enterprise environments with corporate AI proxies. This works with any configured provider (OpenAI, Anthropic, Google).

```bash
# Configure your provider first
export AI_PROVIDER=openai
export OPENAI_API_KEY="sk-..."

# Then add proxy configuration
export AI_PROXY_URL="https://proxy.shopify.ai"
export AI_PROXY_TOKEN="proxy-token-123"  # Optional, defaults to provider's API key

# Generate configuration through proxy
ovrmnd init myservice --prompt "Configure service for..."
```

**Proxy Environment Variables:**

- `AI_PROXY_URL` - URL of the AI proxy server (e.g., `https://proxy.shopify.ai`)
- `AI_PROXY_TOKEN` - Authentication token for the proxy (optional, defaults to provider's API key)

**When to Use a Proxy:**

- Your organization requires all AI calls to go through a corporate proxy
- You're using a custom LLM gateway that provides an OpenAI-compatible API
- You need to route requests through a specific endpoint for compliance or monitoring

**Requirements:**

- The proxy must support OpenAI-compatible endpoints (`/v1/chat/completions`)
- HTTPS is required for proxy URLs
- The proxy works with any configured provider

### Usage

Use the `--prompt` flag with the `init` command to describe what you need:

```bash
# Research and create configurations
ovrmnd init shopify --prompt "Find the Shopify REST API documentation and create a config for managing products, orders, and customers"

ovrmnd init slack --prompt "Create a Slack API config for sending messages and managing channels"

ovrmnd init stripe --prompt "Generate a Stripe API configuration for payment processing and customer management"
```

The AI will:
- Research the API documentation
- Identify authentication requirements
- Find the most useful endpoints
- Generate a complete YAML configuration
- Include helpful aliases and transformations

### Tips

- Be specific about which endpoints you need
- Include API documentation URLs in your prompt for best results
- Mention if you need specific authentication types
- The AI will use environment variable placeholders for credentials
- Generated configs can be edited and customized as needed

Example with documentation URL:
```bash
ovrmnd init stripe --prompt "Create a config using https://stripe.com/docs/api for payment processing"
```

### Using the AI Prompt Manually

The system prompt used for AI configuration generation is available in [docs/ai-config-prompt.md](docs/ai-config-prompt.md). You can use this prompt with any AI assistant (Claude, ChatGPT, etc.) by replacing the `{serviceName}` and `{prompt}` placeholders.

## Development Progress

See [docs/phases/PROGRESS.md](docs/phases/PROGRESS.md) for detailed implementation progress.
