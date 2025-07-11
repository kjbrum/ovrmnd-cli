# Ovrmnd CLI - Phase Breakdown

## Overview

This document outlines the phased approach for implementing the Ovrmnd CLI tool. Each phase delivers incremental value while building on previous phases.

## Phase 1: Project Scaffolding & Core Infrastructure

**Goal**: Establish the foundational project structure and core utilities

### Tasks:
1. **T-01: Project Setup**
   - Configure TypeScript with strict settings
   - Set up ESLint and Prettier for code quality
   - Configure Jest for testing
   - Create npm scripts for build, test, lint
   - Set up basic CI/CD workflow

2. **T-02: CLI Framework Setup**
   - Integrate yargs for command parsing
   - Implement basic command structure
   - Create entry point (`bin/ovrmnd`)
   - Implement help system

3. **T-03: Core Utilities**
   - Implement error handling framework
   - Create logging utility (with debug mode support)
   - Implement configuration loader (env vars, .env files)
   - Create file system utilities for config discovery

4. **T-04: Project Structure**
   - Define directory structure for commands, utils, types
   - Create TypeScript type definitions for core concepts
   - Set up module aliases for clean imports

### Dependencies: None
### Estimated Duration: 1-2 days

---

## Phase 2: Core API Execution

**Goal**: Implement the core functionality for making API calls via YAML configurations

### Tasks:
1. **T-01: YAML Configuration Engine**
   - Implement YAML parsing with js-yaml
   - Create config discovery (global ~/.ovrmnd/ and local ./.ovrmnd/)
   - Implement config merging (local overrides global)
   - Create config validation framework

2. **T-02: YAML Schema Definition**
   - Define TypeScript interfaces for YAML schema
   - Implement automatic path parameter detection
   - Create parameter mapping logic (path, query, body, header)
   - Implement schema validation

3. **T-03: Authentication Implementation**
   - Implement Bearer Token authentication
   - Implement API Key authentication (header/query)
   - Create environment variable resolution
   - Implement .env file support with dotenv

4. **T-04: Call Command Implementation**
   - Implement HTTP request execution with fetch
   - Create argument parsing and mapping
   - Implement request building (headers, body, query)
   - Handle batch operations

5. **T-05: Dual-Mode Output**
   - Implement human-friendly console output
   - Implement JSON output mode for LLMs
   - Create output formatting utilities
   - Ensure clean separation of stdout/stderr

6. **T-06: Standardized Error Output**
   - Define error schema for JSON mode
   - Implement error transformation
   - Handle network errors, auth failures, API errors
   - Preserve HTTP status codes and details

### Dependencies: Phase 1
### Estimated Duration: 3-4 days

---

## Phase 3: CLI Usability & Developer Experience

**Goal**: Add commands and features that improve discoverability and debugging

### Tasks:
1. **T-01: List Command Implementation**
   - Implement `list services`
   - Implement `list endpoints <service>`
   - Implement `list aliases <service>`
   - Create formatted table output

2. **T-02: Validate Command**
   - Implement YAML syntax validation
   - Check for required fields
   - Validate parameter conflicts
   - Validate alias configurations
   - Provide helpful error messages

3. **T-03: Debug Mode Enhancement**
   - Implement verbose request/response logging
   - Show config resolution process
   - Display cache hit/miss information
   - Ensure debug output goes to stderr

### Dependencies: Phase 2
### Estimated Duration: 2 days

---

## Phase 4: Performance & Optimization

**Goal**: Add caching and response transformation for improved performance

### Tasks:
1. **T-01: Response Caching**
   - Implement cache storage with flat-cache
   - Create cache key generation (URL + headers hash)
   - Implement TTL-based expiration
   - Add cache hit/miss logging

2. **T-02: Cache Command**
   - Implement `cache clear` with optional service/endpoint targeting
   - Add cache statistics display
   - Create cache inspection utilities

3. **T-03: Response Transformation**
   - Implement field extraction
   - Implement field renaming
   - Create transformation pipeline
   - Handle nested object transformations

### Dependencies: Phase 2
### Estimated Duration: 2-3 days

---

## Phase 5: Advanced Features & Shortcuts

**Goal**: Add convenience features for improved usability

### Tasks:
1. **T-01: Alias System**
   - Implement alias parsing in YAML
   - Create alias resolution logic
   - Implement argument merging (CLI overrides alias defaults)
   - Add alias validation

2. ~~**T-02: Test Command**~~ (Skipped - functionality covered by call command with --debug)
   - ~~Implement dry-run mode~~
   - ~~Create test execution without caching~~
   - ~~Add connectivity validation~~
   - ~~Provide detailed test output~~

3. **T-03: Init Command**
   - Create service template generation
   - Include common authentication patterns
   - Generate example endpoints
   - Add interactive prompts for configuration

4. **T-04: Batch Operations**
   - Multiple API calls in single command
   - Sequential execution (safe default)
   - Result aggregation
   - Error handling for partial failures

5. **T-05: AI-Powered Configuration Generation**
   - Natural language prompt support for init command
   - Claude Code SDK integration
   - API documentation research and parsing
   - Intelligent endpoint discovery
   - See [AI Enhancement Plan](plans/ai-init-enhancement.md)

### Dependencies: Phases 2, 3, 4
### Estimated Duration: 3-4 days
### Status: ✅ Completed (2025-07-10)

---

## Phase 6: Multi-Provider LLM Support

**Goal**: Add support for multiple LLM providers (OpenAI, Anthropic, Google) using the OpenAI SDK as a unified interface

### Tasks:
1. **T-01: Migrate to OpenAI SDK**
   - Install openai package
   - Remove @anthropic-ai/sdk dependency
   - Update package.json and package-lock.json

2. **T-02: Create Provider Abstraction**
   - Define provider configuration interface
   - Create provider registry with OpenAI, Anthropic, Google
   - Implement provider selection logic
   - Default to OpenAI provider for new installations

3. **T-03: Update AI Config Generator**
   - Replace Anthropic SDK with provider-based system
   - Dynamic client initialization based on provider
   - Provider-specific model defaults
   - Provider-specific error handling

4. **T-04: Add Provider Support**
   - OpenAI configuration and testing
   - Anthropic via compatibility endpoint
   - Google Gemini via compatibility endpoint
   - Provider-specific error messages

5. **T-05: Documentation & Testing**
   - Provider comparison documentation
   - Configuration examples for each provider
   - Update tests for provider abstraction
   - Clear documentation on provider selection

### Dependencies: Phase 5 (AI config generation)
### Estimated Duration: 2 days

---

## Phase 7: AI Proxy Support

**Goal**: Enable AI calls through corporate proxy servers for any configured provider

### Tasks:
1. **T-01: Add Proxy Configuration**
   - AI_PROXY_URL environment variable
   - AI_PROXY_TOKEN environment variable (optional)
   - Proxy URL validation

2. **T-02: Update Provider System**
   - Override provider base URLs when proxy configured
   - Support proxy-specific model naming
   - Maintain provider abstraction

3. **T-03: Enhanced Error Handling**
   - Proxy-specific error messages
   - Debug logging for proxy configuration
   - Fallback suggestions

4. **T-04: Documentation & Testing**
   - Proxy setup documentation
   - Enterprise configuration examples
   - Integration tests with proxy

### Dependencies: Phase 6 (Multi-provider support)
### Estimated Duration: 1 day
### Status: ✅ Completed (2025-07-11)

---

## Phase 8: GraphQL Support

**Goal**: Extend Ovrmnd CLI to support GraphQL APIs in addition to REST APIs

### Tasks:
1. **T-01: Core GraphQL Types**
   - Add apiType field to ServiceConfig
   - Create GraphQLOperationConfig interface
   - Define GraphQL request/response types
   - Add GraphQL-specific error types

2. **T-02: GraphQL Client Implementation**
   - Create GraphQL execution function
   - Implement GraphQL request building
   - Add GraphQL response parsing
   - Handle GraphQL-specific errors

3. **T-03: Configuration & Validation**
   - Update config validator for GraphQL
   - Add GraphQL query validation
   - Support variable definitions
   - Validate operation types

4. **T-04: Integration with Existing Systems**
   - Update call command for GraphQL routing
   - Ensure authentication works for GraphQL
   - Verify caching for GraphQL queries
   - Test transformations on GraphQL responses

5. **T-05: Testing & Documentation**
   - Unit tests for GraphQL components
   - Integration tests with real GraphQL APIs
   - Update README with GraphQL examples
   - Create GraphQL configuration guide
   - See [GraphQL Support Plan](plans/graphql-support.md)

### Dependencies: Phase 2 (Core API Execution)
### Estimated Duration: 3-4 days

---

## Phase 9: OAuth2 Built-in Authentication

**Goal**: Add OAuth2 as a native authentication type alongside bearer and apikey

### Tasks:
1. **T-01: Core OAuth2 Support**
   - Extend AuthConfig type to include oauth2
   - Implement secure token storage with keytar
   - Create OAuth2Service class
   - Update auth.ts to handle OAuth2 type

2. **T-02: OAuth2 Flows**
   - Implement device flow authentication
   - Implement browser flow with PKCE
   - Add automatic token refresh logic
   - Handle token expiration gracefully

3. **T-03: Auth Commands**
   - Create auth login command
   - Create auth status command
   - Create auth logout command
   - Create auth list command

4. **T-04: Provider Support**
   - Create common provider templates
   - Update init command for OAuth2 setup
   - Add provider detection logic
   - Document provider configurations

5. **T-05: Testing & Documentation**
   - Unit tests for OAuth2Service
   - Integration tests for auth commands
   - Update README with OAuth2 examples
   - Create provider setup guides

### Dependencies: Phase 2 (Core API Execution)
### Estimated Duration: 3-4 days

---

## Documentation & Research Needs

### Documentation to Create:
1. **README.md** - Installation, quick start, basic usage
2. **YAML Schema Reference** - Complete schema documentation
3. **Authentication Guide** - How to configure different auth methods
4. **Plugin Development Guide** - How to create service configurations
5. **LLM Integration Guide** - Best practices for AI agent usage

### Research/Investigation:
1. **Cache Storage Options** - Evaluate flat-cache vs alternatives
2. **YAML Schema Validation** - Best approach for comprehensive validation
3. **Cross-Platform Compatibility** - Test on Windows, macOS, Linux
4. **NPM Publishing Process** - Set up for public distribution

---

## Testing Strategy

Each phase should include:
- Unit tests for individual functions
- Integration tests for commands
- End-to-end tests with mock APIs
- Manual testing on real APIs

## Progress Tracking

Progress will be tracked in `PROGRESS.md` with:
- Phase completion status
- Task completion checkboxes
- Current blockers/issues
- Notes on implementation decisions

## Risk Mitigation

1. **Complex YAML Parsing**: Start simple, iterate on schema
2. **Cross-Platform Issues**: Test early on all platforms
3. **Authentication Security**: Follow best practices, never log secrets
4. **Performance at Scale**: Design cache with large configs in mind

## Success Criteria

Each phase is complete when:
- All tasks are implemented
- Tests are passing
- Documentation is updated
- Code is reviewed and refactored
- Progress is tracked in PROGRESS.md