# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ovrmnd CLI is a universal command-line interface that bridges LLMs and REST APIs using declarative YAML configurations. It outputs JSON by default (optimized for LLM consumption) with an optional --pretty flag for human-readable output.

## Current Status & Important Files

**Key Documentation**:
- `docs/phases/PROGRESS.md` - **ALWAYS CHECK FIRST** to understand current implementation status
- `docs/phase-breakdown.md` - Detailed implementation phases
- `docs/product-requirements-doc-ovrmnd-cli.md` - Full product requirements

**Update Requirements**:
- After any work: Update `docs/phases/PROGRESS.md`
- After structural changes: Update this `CLAUDE.md` file
- After any work or interactions with the user: Update `LEARNINGS.md` with anything useful for the future

## Development Commands

```bash
# Development
npm run build         # Compile TypeScript to JavaScript
npm run dev          # Run in development mode with hot reload
npm test             # Run all tests
npm test -- --watch  # Run tests in watch mode
npm test path/to/file # Run specific test file

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix auto-fixable lint issues
npm run format       # Run Prettier
npm run typecheck    # Run TypeScript type checking

# CLI Usage
npm start -- [command]  # Run CLI in development
ovrmnd [command]        # Run installed CLI
```

## Architecture & Code Structure

### Core Components

**Already Implemented (Phase 1)**:
- TypeScript project with strict configuration
- Yargs CLI framework with command pattern
- Core utilities: error handling, logging, config utils, output formatter
- Project directory structure
- Base command class for consistent command implementation

**Already Implemented (Phase 2)**:
- YAML configuration engine with validation
- Authentication system (Bearer token, API key)
- HTTP client with request execution
- Parameter mapping and routing
- Call command with dot notation (service.endpoint)
- Dual-mode output (JSON by default, --pretty for human-friendly)

**Already Implemented (Phase 3)**:
- List command (services, endpoints, aliases)
- Validate command with semantic validation
- Debug mode with detailed logging

**Already Implemented (Phase 4)**:
- Response caching with TTL
- Cache management commands
- Response transformations (field extraction, renaming)

**Already Implemented (Phase 5)**: ✅ COMPLETE
- Alias system for command shortcuts
- Init command with interactive prompts
- AI-powered configuration generation (multi-provider support)
- Batch operations for multiple API calls (sequential execution)

**Already Implemented (Phase 6)**: ✅ COMPLETE
- Multi-provider LLM support (OpenAI, Anthropic, Google)
- Migrated from Anthropic SDK to OpenAI SDK
- Provider abstraction with environment-based selection
- Backward compatibility for existing ANTHROPIC_API_KEY users

**To Be Implemented**:

**Phase 7: AI Proxy Support**
1. **Implementation Approach**
   - Build on Phase 6's provider system
   - Add proxy URL override for any provider
   - Support enterprise proxy configurations
   - See `docs/plans/ai-proxy-configuration.md` for details

2. **Environment Variables**
   - `AI_PROXY_URL`: Proxy endpoint URL (optional)
   - `AI_PROXY_TOKEN`: Proxy authentication (optional)

3. **Benefits**
   - Enterprise proxy support
   - Works with any configured provider
   - Simple base URL override mechanism

**Phase 8: OAuth2 Built-in Authentication**
1. **OAuth2 as Native Auth Type**
   - OAuth2 added alongside bearer and apikey types
   - No plugin system needed - built directly into CLI
   - Simpler implementation and better performance
   - See `docs/plans/oauth2-built-in-auth.md` for details

2. **OAuth2 Implementation**
   - Device flow (recommended for CLI apps)
   - Authorization code flow with PKCE
   - Secure token storage using keytar
   - Automatic token refresh
   - Provider templates for common services

3. **New CLI Commands**
   - `ovrmnd auth login <service>` - Interactive OAuth2 setup
   - `ovrmnd auth logout <service>` - Revoke tokens
   - `ovrmnd auth status <service>` - Check auth status
   - `ovrmnd auth list` - List authenticated services

**Additional Features** (Future enhancements)
   - Parallel batch execution with concurrency control
     - Add --parallel flag for concurrent execution
     - Rate limiting and concurrency limits
     - Progress tracking for parallel operations
     - See `docs/plans/parallel-batch-execution.md` for details
   - Plugin system for extensibility (see `docs/plans/future-plugin-system.md`)
   - Global config override with --config flag
   - WebSocket support for real-time APIs
   - GraphQL support
   - Request/response middleware system
   - OAuth 1.0a support via plugins

### YAML Configuration Pattern

```yaml
serviceName: string              # Required: Service identifier
baseUrl: string                  # Required: Base API URL
authentication:                  # Optional
  type: bearer | apikey         # Auth type
  token: ${ENV_VAR}            # Token/key from environment
  header?: string              # Custom header name (apikey only)
endpoints:                      # Required: Array of endpoints
  - name: string               # Endpoint identifier
    method: GET|POST|PUT|DELETE|PATCH
    path: string               # URL path with {param} placeholders
    cacheTTL?: number         # Cache duration in seconds
    headers?: object          # Additional headers
    defaultParams?: object    # Default query/body params
aliases:                       # Optional: Shortcuts
  - name: string              # Alias identifier
    endpoint: string          # Target endpoint name
    args: object              # Pre-filled arguments
```

### Testing Approach

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test CLI commands end-to-end
- **Mock APIs**: Use mock responses for API testing
- **Coverage Target**: 80%+ code coverage

### Error Handling Philosophy

1. Validate early (configuration loading)
2. Provide helpful error messages with context
3. Use proper exit codes for CLI failures
4. Include --debug flag information in errors

## Implementation Phases

1. **Phase 1**: TypeScript setup, CLI framework, basic structure ✅ COMPLETE
2. **Phase 2**: YAML config, authentication, API execution (MVP) ✅ COMPLETE
3. **Phase 3**: List, validate, debug commands ✅ COMPLETE
4. **Phase 4**: Caching, response transformations ✅ COMPLETE
5. **Phase 5**: Aliases, init command (with AI support), batch operations ✅ COMPLETE
6. **Phase 6**: Multi-provider LLM support (OpenAI, Anthropic, Google) ✅ COMPLETE
7. **Phase 7**: AI proxy support (enterprise proxy configuration)
8. **Phase 8**: OAuth2 built-in authentication

## Development Guidelines

- **TypeScript**: Use strict mode, avoid `any` types
- **Error Messages**: Include actionable steps for users
- **Environment Variables**: Never commit secrets, use .env.example
- **Testing**: Write tests alongside implementation
- **Documentation**: Update README.md for user-facing changes
- **IMPORTANT: Linting and Code Formatting**: After making code changes, always lint and format everything using `npm run lint` and `npm run format`

## Common Tasks

### Adding a New Command
1. Create handler in `src/commands/`
2. Register in `src/cli/index.ts`
3. Add tests in `tests/commands/`
4. Update README.md with usage

### Adding Authentication Type
1. Extend `AuthConfig` type in `src/types/`
2. Implement in `src/api/auth.ts`
3. Add validation in `src/config/validator.ts`
4. Document in README.md
5. For OAuth2: Update OAuth2Service with provider-specific quirks

### Debugging Issues
- Use `--debug` flag for verbose output
- Check `~/.ovrmnd/` for global configs
- Validate YAML with `ovrmnd validate`
- Test API calls with `ovrmnd test`

### AI Configuration Generator

The init command supports AI-powered configuration generation using multiple LLM providers.

**Implementation Details**:
- Service class: `src/services/ai-config-generator.ts`
- Uses OpenAI SDK as unified interface for all providers
- Supports OpenAI (default), Anthropic, and Google Gemini providers
- Provider selection via `AI_PROVIDER` environment variable
- Requires appropriate API key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`
- Configurable via `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE` env vars
- Validates generated configs using existing schema validation
- Enhanced security validation for HTTPS URLs and proper token formats
- **XML-structured prompts**: Following best practices with modular prompt structure
- **Prompt files**: Main prompt in `docs/prompts/ai-config-base.xml`, examples in `docs/prompts/examples/`

**Usage**:
```bash
# Default (OpenAI)
export OPENAI_API_KEY="sk-..."
ovrmnd init <service> --prompt "description of what you need"

# Anthropic
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
ovrmnd init <service> --prompt "description of what you need"

# Google Gemini
export AI_PROVIDER=google
export GOOGLE_API_KEY="..."
ovrmnd init <service> --prompt "description of what you need"
```

**Testing**:
- Unit tests mock the OpenAI SDK
- Integration tests skip if no real API key is available
- Test with real API key: `npm test tests/integration/ai-init.test.ts`

## CLI Testing

**IMPORTANT**: Always test CLI changes with real API calls to ensure functionality works as expected.

### Test Configuration

Use `.ovrmnd/testing.yaml` for all CLI testing. This file should be kept up to date with the latest configuration structure and features.

```bash
# Basic testing commands
node dist/cli.js call testing.listUsers           # List all users (JSON output by default)
node dist/cli.js call testing.getUser id=1        # Get specific user (JSON output by default)
node dist/cli.js call testing.me                  # Test alias (JSON output by default)
node dist/cli.js call testing.listUsers --pretty  # Human-readable output

# Test error cases
node dist/cli.js call testing                     # Invalid format
node dist/cli.js call testing.nonexistent         # Missing endpoint

# Test parameter types
node dist/cli.js call testing.createUser name="John Doe" email="john@example.com"
node dist/cli.js call testing.listUsers --query limit=5 page=2
node dist/cli.js call testing.test --header X-Custom-Header=value
```

### Updating Test Configuration

When adding new features to the YAML configuration structure, **ALWAYS** update `.ovrmnd/testing.yaml` to include:
- New authentication types
- New endpoint configurations
- New alias patterns
- Header configurations
- Default parameters
- Cache TTL settings
- Any other new YAML features

This ensures we can test all functionality with real API calls during development.

### Test YAML Files

Invalid YAML files for testing the validate command are located in `tests/fixtures/yaml/`:
- `invalid-test.yaml` - Various validation errors (missing fields, duplicates, etc.)
- `syntax-error.yaml` - YAML syntax errors (indentation, missing colons)
- `semantic-test.yaml` - Semantic warnings (env vars, cache on non-GET, etc.)

To test validation:
```bash
ovrmnd validate --file tests/fixtures/yaml/invalid-test.yaml
ovrmnd validate --file tests/fixtures/yaml/syntax-error.yaml --pretty
```

### Running Comprehensive Tests

Use the `run-tests` command to execute all test suites and manual CLI tests:

```bash
# Use Claude Code to run all tests
/run-tests
```

This command will:
1. Run all automated test suites
2. Execute code quality checks (lint, typecheck, format)
3. Guide through manual CLI testing with testing.yaml
4. Verify all output formats and error handling

**Always run this command before committing significant changes.**

### Test Maintenance

- **Important**: Ensure the `.claude/commands/run-tests.md` command is kept up to date any time new functionality is added that needs to be tested

## Memories and Insights

- When updating documentation, you don't need to include things like "All tests passing (80+ tests)" or "All linting and type checking passes". It's just assumed that everything is passing and formatted as it should be
