# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ovrmnd CLI is a universal command-line interface that bridges LLMs and REST APIs using declarative YAML configurations. It provides both human-friendly and machine-readable (JSON) output modes.

## Current Status & Important Files

**Project Phase**: Planning Complete - Ready for Phase 1 Implementation

**Key Documentation**:
- `docs/phases/PROGRESS.md` - **ALWAYS CHECK FIRST** to understand current implementation status
- `docs/phase-breakdown.md` - Detailed implementation phases
- `docs/product-requirements-doc-ovrmnd-cli.md` - Full product requirements

**Update Requirements**:
- After any work: Update `docs/phases/PROGRESS.md`
- After structural changes: Update this `CLAUDE.md` file
- After learnings: Update `LEARNINGS.md`

## Development Commands

**Note**: Project setup is not yet complete. These commands will be available after Phase 1 implementation:

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

### Core Components (To Be Implemented)

1. **CLI Framework** (`src/cli/`)
   - Command parser using yargs
   - Command handlers for: call, list, cache, init, validate, test
   - Global options: --debug, --json, --config

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