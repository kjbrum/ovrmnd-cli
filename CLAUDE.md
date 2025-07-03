# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ovrmnd CLI is a universal command-line interface that bridges LLMs and REST APIs using declarative YAML configurations. It provides both human-friendly and machine-readable (JSON) output modes.

## Current Status & Important Files

**Project Phase**: Phase 2 In Progress - Core API Execution (80% complete)

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
- Dual-mode output (human-friendly and JSON)

**To Be Implemented**:

1. **CLI Framework** (`src/cli/`)
   - Command handlers for: list, cache, init, validate, test
   - Global options: --config

2. **Configuration Engine** (`src/config/`)
   - YAML parser and validator
   - Service discovery from ~/.ovrmnd/ and ./.ovrmnd/
   - Environment variable interpolation (${VAR_NAME})
   - Schema validation for YAML structure

3. **API Client** (`src/api/`)
   - HTTP client with authentication support (Bearer, API Key)
   - Request builder from YAML endpoint definitions
   - Response transformation and error handling

4. **Cache System** (`src/cache/`)
   - TTL-based caching for GET requests
   - Cache invalidation commands
   - Persistent storage using flat-cache

5. **Output Formatters** (`src/formatters/`)
   - Human-readable formatter (default)
   - JSON formatter for LLM consumption
   - Debug output with request/response details

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

1. **Phase 1**: TypeScript setup, CLI framework, basic structure
2. **Phase 2**: YAML config, authentication, API execution (MVP)
3. **Phase 3**: List, validate, debug commands
4. **Phase 4**: Caching, response transformations
5. **Phase 5**: Aliases, test mode, init command

## Development Guidelines

- **TypeScript**: Use strict mode, avoid `any` types
- **Error Messages**: Include actionable steps for users
- **Environment Variables**: Never commit secrets, use .env.example
- **Testing**: Write tests alongside implementation
- **Documentation**: Update README.md for user-facing changes
- **Linting and Code Formatting**: After making code changes, always lint and format everything using `npm run lint` and `npm run format`

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

### Debugging Issues
- Use `--debug` flag for verbose output
- Check `~/.ovrmnd/` for global configs
- Validate YAML with `ovrmnd validate`
- Test API calls with `ovrmnd test`

## CLI Testing

**IMPORTANT**: Always test CLI changes with real API calls to ensure functionality works as expected.

### Test Configuration

Use `.ovrmnd/testing.yaml` for all CLI testing. This file should be kept up to date with the latest configuration structure and features.

```bash
# Basic testing commands
node dist/cli.js call testing.listUsers           # List all users
node dist/cli.js call testing.getUser id=1        # Get specific user
node dist/cli.js call testing.me                  # Test alias
node dist/cli.js call testing.listUsers --json    # JSON output

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