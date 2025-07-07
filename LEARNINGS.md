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

## Validate Command Implementation

### Design Approach
- Created two-layer validation: schema validation (using existing Zod) and semantic validation
- ConfigValidator class handles all validation logic
- ValidateCommand is a thin wrapper that handles file discovery and output formatting
- Support for validating all configs, specific service, or specific file

### YAML Error Handling
- js-yaml provides line numbers through error.mark.line (0-based, need to add 1)
- Syntax errors include snippet context showing the problematic line
- Line numbers crucial for user-friendly error reporting

### Semantic Validation Features
1. **Authentication checks**: Missing auth config, missing tokens, API key without header
2. **Path validation**: Duplicate path parameters, invalid path format
3. **Endpoint validation**: Cache TTL on non-GET, body params on GET, auth headers in endpoints
4. **Alias validation**: References to non-existent endpoints, missing required parameters
5. **Name conflicts**: Duplicate names across endpoints and aliases
6. **Environment variables**: Check if referenced env vars are set
7. **Base URL validation**: Format checking, trailing slash warning, localhost detection

### Strict Mode
- Normal mode: errors fail, warnings pass
- Strict mode (--strict): both errors and warnings fail
- Useful for CI/CD pipelines to enforce best practices

### Testing Challenges
- Unit tests for ConfigValidator are complex due to mocking requirements
- Need to ensure endpoints array exists before calling array methods
- TypeScript strict mode requires careful null/undefined handling
- Integration tests work well with real YAML files

### File Discovery Pattern
- Reused existing discovery logic from ConfigDiscovery
- Support for --config flag to specify custom directory
- Validates files in both global (~/.ovrmnd) and local (./.ovrmnd) directories
- Service filtering can use filename or peek into serviceName field

### Output Formatting
- Consistent with other commands: JSON by default, --pretty for human-readable
- Errors show file path, line number, context, and suggestions
- Summary table shows total files, errors, and warnings
- Clear exit codes: 0 for success, 1 for validation failure

## Debug Mode Implementation

### Key Design Decisions

1. **Separate Debug Formatter**: Created a dedicated `DebugFormatter` class instead of using the logger directly. This provides:
   - Consistent formatting across all debug output
   - Easy enable/disable through constructor flag
   - Specialized formatting methods for different types of debug info

2. **stderr vs stdout**: All debug output goes to stderr to keep stdout clean for data output. This allows users to pipe data while still seeing debug info.

3. **Redaction Strategy**: Authentication headers are partially redacted (showing first 4 and last 4 chars) rather than fully hidden, which helps with debugging while maintaining security.

4. **Optional Dependency Injection**: Debug formatter is passed as an optional parameter through the call chain, allowing components to work with or without debug mode.

### Implementation Pattern

```typescript
// Pass debug formatter through the chain
const debugFormatter = new DebugFormatter(args.debug ?? false)
const config = await loadServiceConfig(service, debugFormatter)
const response = await callEndpoint(config, endpoint, params, debugFormatter)
```

### Categories of Debug Output

- `CONFIG`: Configuration loading and resolution
- `REQUEST`: HTTP request details
- `RESPONSE`: HTTP response details  
- `PARAMS`: Parameter mapping
- `ENV`: Environment variable resolution
- `CACHE`: Cache hit/miss information

### Testing Approach

Debug output testing uses process.stderr.write mocking to capture and verify output without polluting test logs.

### TypeScript Import Considerations

- ESLint prefers `import type` for type-only imports to optimize bundle size
- Cannot use `import()` syntax for inline type imports with consistent-type-imports rule
- All type imports should be at the top of the file using `import type`

## Response Caching Implementation

### Design Decisions

1. **flat-cache Library**: Used flat-cache for persistent file-based caching. It's simple, reliable, and handles JSON serialization automatically.

2. **Cache Key Generation**: 
   - Uses SHA256 hash of service name, endpoint name, URL, and non-sensitive headers
   - Auth headers (Authorization, X-API-Key, Cookie) are excluded from cache key
   - Headers are normalized to lowercase and sorted for consistent hashing
   - Key format: `service.endpoint.hash16chars`

3. **TTL Implementation**:
   - Each cache entry stores data, timestamp, and TTL value
   - Expiration checked on read - expired entries are removed automatically
   - TTL specified in seconds in YAML config per endpoint

4. **Cache Storage Location**: `~/.ovrmnd/cache/` directory with flat-cache handling file management

5. **Graceful Degradation**: Cache errors don't fail API requests - they're logged but the request continues

### Integration Pattern

```typescript
// Check cache before request
const cachedData = cacheStorage.get(cacheKey)
if (cachedData !== null) {
  return { success: true, data: cachedData, metadata: { cached: true } }
}

// Store successful responses
if (response.status === 200) {
  cacheStorage.set(cacheKey, response.data, endpoint.cacheTTL)
}
```

### Testing Challenges

1. **Mock vs Real Cache**: Integration tests mock flat-cache to control cache behavior precisely
2. **Header Order**: Headers object property order affected cache key generation - solved by sorting
3. **Case Sensitivity**: Headers can have varying case - normalized to lowercase for consistency

### Security Considerations

- Authentication headers excluded from cache keys to prevent auth token leakage
- Different auth tokens get same cached response for same endpoint/params
- Sensitive headers list: authorization, x-api-key, cookie

### Future Enhancements

- Consider memory cache layer for hot data
- Add cache size limits and eviction policies
- Support for ETags and conditional requests

## Cache Command Implementation

### Design Decisions
- Three subcommands: `cache clear`, `cache stats`, `cache list`
- Clear supports patterns: all, by service, or by service.endpoint
- Confirmation prompts for destructive operations (unless --force)
- Stats show total size/entries plus service breakdown with --verbose
- List shows all cached entries with filtering and metadata

### TypeScript Challenges
- exactOptionalPropertyTypes required conditional metadata spreading
- Yargs builder type issues resolved with type casting
- Async/await not needed for stats and list handlers
- Template literals required for all string concatenation (ESLint)

### Implementation Details
- Enhanced CacheStorage to store metadata (service, endpoint, URL)
- Added getRawEntry method for accessing full cache entries
- Metadata passed when caching in client with service/endpoint/URL
- Cache clear returns count of cleared entries for feedback
- Relative time formatting handles "now" as special case

### Testing Approach
- Unit tests mock CacheStorage and OutputFormatter
- Integration tests use real cache with custom directory
- Prompts auto-reject in CI environment (non-TTY)
- Console output mocked to verify formatted messages
- Test both JSON and pretty output modes

### User Experience
- JSON output by default for programmatic use
- --pretty flag for human-readable tables and formatting
- --verbose shows additional detail (cache entry details, service breakdown)
- Clear confirmation can be skipped with --force flag
- Helpful error messages guide users to correct usage
