# Learnings

This file documents important learnings and findings from building this project.

## General

- Phase-based development worked well - each phase delivers incremental value
- Test-driven development caught many edge cases early
- TypeScript strict mode is challenging but prevents runtime errors

## Coding

### Configuration System
- Used Zod for comprehensive YAML validation - provides excellent error messages
- Separated concerns: parsing, discovery, merging, validation, env resolution
- Path parameter extraction using regex: `/\{([^}]+)\}/g`
- Config discovery checks local first (`./.ovrmnd/`) then global (`~/.ovrmnd/`)
- Environment variable resolution happens after config loading

### TypeScript Strict Mode Challenges
- `exactOptionalPropertyTypes` requires explicit `| undefined` in interfaces
- Index signature access requires bracket notation (e.g., `params['_']`)
- Array type narrowing sometimes requires explicit casting
- ESLint disable needed for complex generic array type casting

### Authentication Implementation
- Bearer token and API key both supported
- API key can go in header (default: X-API-Key) or query params
- Redaction logic for sensitive headers keeps first/last 4 chars visible
- Switch statement with block scope needed for ESLint no-case-declarations

### HTTP Client Design
- Used native fetch API (no axios needed)
- AbortController for timeout implementation
- Separate URL building from request execution
- Headers object needs conversion to plain object for response

### Parameter Mapping Strategy
1. Path parameters have highest priority (required)
2. Hinted parameters (header/query/body) next
3. Remaining params auto-mapped based on HTTP method
4. GET/DELETE → query params, POST/PUT/PATCH → body
5. Default params applied last (don't override provided values)

### Testing Approach
- Mock fetch globally in tests: `global.fetch = jest.fn()`
- Test both success and error paths
- Use type assertions for error testing
- Separate unit tests by module for better organization

### ESLint/Prettier Integration
- Need separate tsconfig for ESLint to include test files
- Prettier handles most formatting automatically
- Some ESLint rules conflict with TypeScript strict mode

## Call Command Implementation

### Command Structure
- Implemented using yargs command pattern with BaseCommand class
- Uses dot notation for target: `service.endpoint` or `service.alias`
- Supports positional params and typed params (--path, --query, --header, --body)
- Handles both endpoints and aliases seamlessly
- Clean integration with all other modules

### Parameter Handling
- Positional parameters parsed as key=value pairs
- Typed parameters override positional ones
- Alias parameters are merged with user parameters (user wins)
- Parameter hints guide the mapping logic

### API Response Handling
- Transformed HTTP responses to standard ApiResponse format
- Success/failure pattern with proper error details
- Consistent output formatting for both modes
- Process exit codes for success/failure

### Testing Strategy
- Comprehensive unit tests for all scenarios
- Mock all external dependencies
- Test both success and error paths
- Verify parameter mapping and transformations
- Test invalid target format validation

## Output Format Decision
- Switched from human-readable default to JSON default
- JSON output better aligns with tool's purpose (LLM bridge)
- `--pretty` flag provides human-readable format when needed
- This follows patterns like AWS CLI rather than GitHub CLI
- Makes piping and scripting easier by default

## stdout/stderr Separation
- All logger output (debug, info, warn, error) goes to stderr
- API response data goes to stdout
- Winston configured with `stderrLevels` for all log levels
- Enables clean piping: `ovrmnd call api.users | jq .`
- CLI errors use console.error (stderr) while data uses process.stdout.write

## Future Considerations
- Batch operations moved to Phase 5 (Advanced Features)
- Cache implementation should use flat-cache as planned
- Error schema for JSON mode should include request details
- Consider supporting multiple targets: `ovrmnd call github.listRepos api.users`
- Could add config option to set default output format preference
