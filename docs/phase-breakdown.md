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

## Phase 6: Parallel Batch Execution

**Goal**: Enhance batch operations with concurrent execution for improved performance

### Tasks:
1. **T-01: Parallel Execution Core**
   - Add --parallel flag for concurrent execution
   - Implement concurrency limiting (--concurrency flag)
   - Promise pool pattern for controlled parallelism
   - Preserve result order despite parallel execution

2. **T-02: Rate Limiting**
   - Add rate limiting support (--rate-limit flag)
   - Token bucket algorithm implementation
   - Configurable requests per second
   - Automatic retry on rate limit errors (429)

3. **T-03: Enhanced Progress Tracking**
   - Real-time progress updates for parallel operations
   - Display concurrent request count
   - Show completion rate and estimated time
   - Consider progress bar library integration

4. **T-04: Advanced Error Handling**
   - Fail-fast mode with request cancellation
   - AbortController for in-flight request cancellation
   - Detailed error aggregation with indices
   - Partial result handling

5. **T-05: Configuration Support**
   - YAML configuration for rate limits
   - Per-endpoint concurrency settings
   - Default retry policies
   - See [Parallel Batch Execution Plan](plans/parallel-batch-execution.md)

### Dependencies: Phase 5 (specifically batch operations)
### Estimated Duration: 2-3 days

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