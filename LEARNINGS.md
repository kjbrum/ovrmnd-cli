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

## Standardized Error Output
- Created JsonError interface with consistent structure for LLM parsing
- Includes error details, help text, and full request/response context
- OvrmndError enhanced with toJsonError() method for serialization
- HTTP client captures all context (headers, body, status) in errors
- formatError method in OutputFormatter handles both JSON and human modes
- Human format shows error code, message, details, help, and status
- JSON format includes timestamp and preserves all error metadata

## TypeScript exactOptionalPropertyTypes
- When enabled, optional properties require explicit `| undefined` in type definitions
- Affects how optional properties are accessed - need `?.` for potentially undefined
- In tests, need careful handling: `resolved.aliases?.[0]?.args?.['username']`
- Validator schemas with `.optional()` work correctly with this setting
- Environment resolver handles undefined checks properly for optional fields
- All optional endpoint fields (headers, defaultParams, cacheTTL) work correctly

## Testing process.exit in Jest
- Mocking process.exit in Jest is tricky - it sets process.exitCode internally
- Best approach: mock to return undefined and check if mock was called
- Tests may show as "failed" in Jest even when all assertions pass
- This is a known Jest limitation when testing process.exit calls
- Alternative: refactor to throw errors instead of calling process.exit directly

## List Command Implementation

### Design Decisions
- Implemented as subcommands: `list services`, `list endpoints <service>`, `list aliases <service>`
- Uses same dual-mode output pattern (JSON default, --pretty for tables)
- Table formatting added to OutputFormatter with overloaded signatures
- Supports both headers/rows array style and data/options object style
- Clean separation of stdout (data) and stderr (UI messages)

### Table Formatting
- ASCII table implementation with Unicode box-drawing characters
- Column width calculation based on content
- Headers in bold using chalk
- Supports empty data with appropriate messaging
- In JSON mode, table() returns raw JSON instead

### Error Handling
- Service not found errors include help text to list available services
- Validation in builder ensures service name provided for endpoints/aliases
- Consistent error formatting using OvrmndError

### TypeScript Challenges
- Yargs type inference issues with positional arguments
- Had to cast builder return type due to complex generics
- Method binding issues fixed by using arrow functions for handler
- Optional path parameter handling in extractParameters

### Testing Approach
- Mocked ConfigDiscovery and OutputFormatter
- Unit tests cover all scenarios including empty states
- Integration tests use temp directories for isolation
- Process.stdout.write spying for JSON output verification

## Future Considerations
- Batch operations moved to Phase 5 (Advanced Features)
- Cache implementation should use flat-cache as planned
- Consider supporting multiple targets: `ovrmnd call github.listRepos api.users`
- Could add config option to set default output format preference
- May want to add error retry logic with exponential backoff
- Consider adding response time tracking in error context
- List command could be enhanced with filtering options (e.g., --filter, --limit)
- Could add sorting options for list output
- Validate command will need careful YAML error reporting
