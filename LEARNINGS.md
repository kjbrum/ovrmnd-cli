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

## Response Transformation Implementation

### Design Decisions

1. **Two-Class Architecture**:
   - `ResponseTransformer`: Handles single transformation (field extraction OR renaming)
   - `TransformPipeline`: Chains multiple transformers for complex transformations
   - Clean separation of concerns and easy to test

2. **Field Path Syntax**:
   - Dot notation for nested fields: `user.profile.name`
   - Array access with brackets: `items[0].id`
   - Handles undefined gracefully - returns undefined instead of throwing

3. **Transform Configuration**:
   - Single transform: `transform: { fields: [...], rename: {...} }`
   - Multiple transforms: `transform: [{ fields: [...] }, { rename: {...} }]`
   - Transforms applied in order, each working on output of previous

4. **Integration with Cache**:
   - Transformed data is what gets cached
   - Cache key doesn't include transform config (same data, different views)
   - Ensures consistency - cached responses match non-cached

### Implementation Patterns

```typescript
// Field extraction
transform: {
  fields: ["id", "name", "address.city", "items[0].price"]
}

// Field renaming
transform: {
  rename: {
    "login": "username",
    "created_at": "createdAt"
  }
}

// Pipeline of transforms
transform: [
  { fields: ["data.users"] },  // Extract nested data
  { rename: { "login": "username" } }  // Then rename fields
]
```

### TypeScript Challenges

1. **Array Type Safety**:
   - ESLint complained about array map returning `any`
   - Fixed by adding type annotation to parameter: `(item: unknown)`

2. **Optional Chaining**:
   - Calling non-existent method on optional type
   - Changed from `debugFormatter?.log()` to `debugFormatter?.debug()`

3. **Generic Type Removal**:
   - `callEndpoint` had unused generic type `T`
   - Removed generic since function returns `StandardApiResponse`

### Testing Strategy

1. **Unit Tests**:
   - Test each transformer method in isolation
   - Cover edge cases: undefined values, missing fields, invalid paths
   - Test array access with out-of-bounds indices

2. **Integration Tests**:
   - Mock API returns complex nested data
   - Apply various transforms and verify output
   - Test caching with transformations

### Performance Considerations

- Transforms happen after network response, adding minimal latency
- JSON stringify used for size calculations in debug mode
- Could optimize by using object size estimation instead

### Error Handling

- Transforms that fail (e.g., invalid path) return undefined
- Pipeline continues even if one transform fails
- Errors logged but don't break the response

### Future Enhancements

- Support for more complex array operations (filtering, mapping)
- JSONPath support for advanced queries
- Custom transform functions via plugins
- Transform validation at config load time

## Test File Organization

### Problem
- Test YAML files (invalid-test.yaml, syntax-error.yaml, semantic-test.yaml) in `.ovrmnd/` directory caused noise during config discovery
- Every command that loaded configs would log errors for these intentionally invalid files
- Files are needed for testing the validate command but shouldn't be in the config directory

### Solution
- Moved test files to `tests/fixtures/yaml/` directory
- Created README in fixtures directory documenting the test files
- Test files can still be validated using: `ovrmnd validate --file tests/fixtures/yaml/invalid-test.yaml`
- Config discovery no longer encounters these files during normal operations

### Key Learning
- Test fixtures should be separated from runtime configuration directories
- Use dedicated test directories to avoid polluting the application's configuration space
- Document test fixtures clearly so they can be used for manual testing

## Validate Command Output Formatting

### Problem
- Duplicate icons appeared in error and warning messages (e.g., `✗ ✖ Error:` instead of just `✖ Error:`)
- The `formatError()` and `warning()` methods in OutputFormatter already add icon prefixes
- Validation passed/failed messages also had duplicate icons

### Solution
1. **Remove explicit icons from message strings**: Since the formatter methods add icons, don't include them in the message
   - Changed `formatter.formatError('✖ Error: ...')` to `formatter.formatError('Error: ...')`
   - Changed `formatter.warning('⚠ Warning: ...')` to `formatter.warning('Warning: ...')`
   - Changed final messages from `'✖ Validation failed'` to `'Validation failed'`

2. **Add dim() method to OutputFormatter**: Created a new method for subtle text formatting
   ```typescript
   dim(message: string): string {
     if (this.jsonMode) {
       return message
     }
     return chalk.gray(message)
   }
   ```

3. **Consistent suggestion formatting**: All suggestions now use `formatter.dim()` for subtle gray text

### TypeScript/ESLint Considerations
- When using methods that return typed values, ESLint may require explicit type annotations
- Fixed `Unsafe assignment of an 'any' value` by importing and using the correct type:
  ```typescript
  import type { JsonError } from '../types/error'
  const jsonError: JsonError = error.toJsonError()
  ```

### Key Learnings
1. **Check existing formatter methods**: Before adding icons or formatting, verify what the formatter already provides
2. **Consistency in formatting**: Use the same formatting approach (dim/gray) for all similar content (suggestions)
3. **Type imports for ESLint**: When ESLint complains about unsafe assignments, check if you need to import the type
4. **Visual hierarchy**: Use different text styles (bold, normal, dim) to create clear visual hierarchy in CLI output

## Init Command Interactive Mode

### Design Decision
- Changed from using `--pretty` flag to control interactive mode to a dedicated `--interactive|-i` flag
- This provides clearer intent and separation of concerns:
  - `--pretty` is for output formatting (JSON vs human-readable)
  - `--interactive` is for controlling user interaction during configuration
- Aligns with common CLI patterns where interactive mode is explicitly opted into

### Implementation Details
1. **Flag Addition**: Added `interactive` boolean option with alias `-i` to the command builder
2. **Args Interface**: Updated `InitArgs` to include `interactive: boolean` property
3. **Handler Logic**: Changed conditional from `args.pretty` to `args.interactive` for prompting behavior
4. **Help Text**: Updated examples to show `--interactive` usage instead of `--pretty`

### Testing Updates
- All test cases updated to use `--interactive` instead of `--pretty` for interactive mode
- Tests remain comprehensive, covering both interactive and non-interactive flows
- Mock implementations continue to work correctly with the new flag

### Key Learning
When a flag is being used for multiple purposes (output formatting AND behavior control), it's better to split into separate flags with clear, single responsibilities. This makes the CLI more intuitive and the code more maintainable.

## Batch Operations Implementation

### Design Decisions

1. **Sequential vs Parallel Execution**:
   - Implemented sequential execution rather than parallel
   - Avoids rate limiting issues with APIs
   - Simpler error handling and progress tracking
   - Could add parallel option in future if needed

2. **Batch JSON Format**:
   - Array of parameter objects: `[{"id": "1"}, {"id": "2"}]`
   - Each object represents parameters for one API call
   - Empty objects allowed (uses defaults/aliases)

3. **Parameter Merging Order**:
   - Alias parameters < Batch parameters < CLI parameters
   - CLI parameters override everything (apply to all requests)
   - Allows flexible batch operations with common overrides

4. **Error Handling Modes**:
   - Default: Continue on error, collect all results
   - `--fail-fast`: Stop on first error
   - Exit code 1 if any request fails

5. **Output Formatting**:
   - JSON mode: Array of results with success/error status
   - Pretty mode: Individual results with summary statistics
   - Progress indication in debug mode only

### Implementation Patterns

```bash
# Basic batch operation
ovrmnd call api.getUser --batch-json='[{"id":"1"},{"id":"2"},{"id":"3"}]'

# With fail-fast
ovrmnd call api.getUser --batch-json='[{"id":"1"},{"id":"999"}]' --fail-fast

# With CLI parameter override
ovrmnd call api.getUser --batch-json='[{"id":"1"},{"id":"2"}]' --query format=json

# With alias and batch override
ovrmnd call api.me --batch-json='[{},{"id":"5"}]'  # First uses alias default, second overrides
```

### TypeScript Challenges

1. **JSON Parsing Type Safety**:
   - `JSON.parse()` returns `any`, requiring explicit type assertion
   - Cast to `unknown` first, then validate with Array.isArray()
   - Finally cast to `Record<string, unknown>[]`

2. **Parameter Type Conversion**:
   - Batch JSON can contain any types, but RawParams expects specific types
   - Created `convertToRawParams()` helper to safely convert
   - Handles null/undefined by converting to string

3. **String Concatenation**:
   - ESLint prefers template literals over string concatenation
   - Changed all `+ '\n'` to template literals

### Testing Strategy

1. **Unit Tests**:
   - Mock `callEndpoint` to control responses
   - Test parameter merging precedence
   - Verify error handling modes
   - Check output formatting

2. **Integration Tests**:
   - Use real JSONPlaceholder API
   - Test actual network requests
   - Verify batch execution flow
   - Check progress output in debug mode

### Performance Considerations

- Sequential execution prevents overwhelming APIs
- No connection pooling or rate limiting needed
- Progress indication helps with long-running batches
- Could add `--parallel` flag with concurrency limit in future

### Error Handling

- Each request wrapped in try/catch
- Errors converted to ApiResponse format
- Original error details preserved
- Exit code reflects overall success/failure

### Future Enhancements

- Parallel execution with concurrency control (see [Parallel Batch Execution Plan](docs/plans/parallel-batch-execution.md))
- Batch file input (JSON file instead of CLI arg)
- Progress bar for large batches
- Retry logic for failed requests
- Result filtering/transformation

### Why Sequential Execution Was Chosen

1. **Rate Limiting Safety**: Sequential execution naturally prevents overwhelming APIs with too many concurrent requests. Many APIs have rate limits (e.g., 100 requests/minute), and parallel execution could easily exceed these limits.

2. **Simpler Implementation**: Sequential execution avoids complex concurrency control, thread-safe result collection, and race condition handling.

3. **Predictable Behavior**: Errors occur in order, progress is linear, and debugging is straightforward.

4. **Good Default**: Makes the tool a "good citizen" by default - users must explicitly opt into parallel execution if they understand their API's limits.

### Parallel Execution Considerations

When implementing parallel execution (Phase 5, T-06), key challenges include:

1. **Concurrency Control**: Need to limit simultaneous connections to prevent resource exhaustion
2. **Rate Limiting**: Must implement token bucket or sliding window algorithms
3. **Error Handling**: Fail-fast mode requires cancelling in-flight requests
4. **Progress Tracking**: Need thread-safe progress updates and possibly progress bars
5. **Result Ordering**: Must preserve input order despite async completion
6. **Memory Management**: Large batches could consume significant memory if not handled carefully

See the full implementation plan in [docs/plans/parallel-batch-execution.md](docs/plans/parallel-batch-execution.md)

## AI-Powered Configuration Generation

### Design Decisions

1. **Integration Approach**:
   - Added as an option to existing init command rather than separate command
   - Uses `--prompt` flag to trigger AI mode
   - Maintains all existing init functionality (--force, --global, --output)

2. **AI Provider Choice**:
   - Used Anthropic SDK with Claude 3.5 Sonnet model
   - Temperature set to 0 for consistent, deterministic output
   - Max tokens set to 4000 to accommodate complex configs

3. **Prompt Engineering**:
   - System prompt includes full ServiceConfig TypeScript interface
   - Added detailed property descriptions and examples
   - Clear guidelines for each field (e.g., always use ${ENV_VAR} format)
   - Examples of common endpoint patterns (list, get, create, update, delete)

4. **Error Handling**:
   - Validates AI-generated JSON using existing Zod schema
   - Graceful fallback for API errors
   - Clear error messages guide users to fix issues

### System Prompt Improvements

The system prompt evolved through iterations to be more precise:

1. **Initial Version**: Basic interface with minimal guidance
2. **Enhanced Version**: Added detailed property descriptions:
   - Explained what each property is used for
   - Provided format examples (e.g., 'github', 'shopify-admin')
   - Specified constraints (e.g., no trailing slash in baseUrl)
   - Included common patterns and best practices

3. **Key Guidelines Added**:
   - serviceName: Use lowercase with hyphens
   - baseUrl: Include protocol, no trailing slash
   - endpoints.name: Use camelCase, be descriptive
   - endpoints.path: Use {param} syntax, NOT :param
   - cacheTTL: Different values for stable vs changing data
   - transform: Examples of field extraction and renaming

4. **Research Process Clarification**:
   - Made explicit that AI should use WebFetch for documentation research
   - Expanded endpoint selection criteria:
     * Focus on endpoints from documentation examples
     * Match user's specific needs
     * Include foundational endpoints plus specialized ones
   - Added sub-tasks for endpoint analysis:
     * Identify query parameters for defaultParams
     * Analyze response structure for transforms
     * Find common use cases for aliases
   - Emphasized generating "smart defaults" based on research

### Implementation Patterns

```typescript
// Extract environment variable from AI-generated config
const extractEnvVarName = (token?: string): string | undefined => {
  if (!token) return undefined
  const match = token.match(/\${([^}]+)}/)
  return match ? match[1] : undefined
}

// JSON extraction from AI response
const extractJSON = (text: string): unknown => {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw error
  return JSON.parse(jsonMatch[0])
}
```

### Testing Approach

1. **Unit Tests**:
   - Mock Anthropic SDK completely
   - Test all error scenarios
   - Verify system prompt includes key information

2. **Integration Tests**:
   - Skip when no API key available
   - Test real API calls when possible
   - Verify end-to-end flow

### TypeScript Challenges

1. **Environment Variable Access**:
   - ESLint requires bracket notation: `process.env['ANTHROPIC_API_KEY']`
   - Not `process.env.ANTHROPIC_API_KEY`

2. **Mock Implementation**:
   - Anthropic.APIError constructor issues in tests
   - Fixed with Object.create and Object.assign pattern

3. **Type Safety**:
   - AI response content requires type checking
   - Cast unknown JSON to ServiceConfig after validation

### Security Considerations

- API key required via environment variable
- Never log or expose API keys
- AI instructed to use ${ENV_VAR} format for all tokens
- Validated configs checked for proper token format

### User Experience

1. **Progress Indication**:
   - Shows "🤖 Using AI to research and generate configuration..." in pretty mode
   - Helps set expectations for API call delay

2. **Next Steps**:
   - Extracts environment variable names from generated config
   - Includes in next steps output
   - Guides users to set required environment variables

3. **Error Messages**:
   - Clear indication when API key is missing
   - Helpful error messages for validation failures
   - Suggests rephrasing prompt if generation fails

### Future Enhancements

- Support for other AI providers (OpenAI, etc.)
- Iterative refinement based on validation errors
- Learning from user's existing configs
- Caching successful patterns for common services

### System Prompt Architecture

- Moved system prompt to separate markdown file (`docs/ai-config-prompt.md`)
- Benefits:
  * Prompt is easily accessible for users who want to use it manually
  * Single source of truth for the prompt
  * Can be versioned and tracked separately
  * Easier to update without modifying code
- Implementation loads prompt from file, no fallback
- If prompt file is missing, throws proper error indicating installation issue
- File is simple markdown with just the prompt content (no extra sections)
- Placeholders `{serviceName}` and `{prompt}` are replaced at runtime
- Decision: No fallback prompt because if the file is missing, it's a bigger issue that should be fixed

## AI Configuration Security Enhancements

### Model Selection
- Changed default model from `claude-3-5-sonnet-20241022` to `claude-3-5-haiku-20241022`
- Haiku is faster and more cost-effective for configuration generation
- Still produces high-quality configurations for this use case
- Users can override with `AI_MODEL` env var if they need a more capable model

### Environment Variable Configuration
- Updated to use generic `AI_` prefix instead of `ANTHROPIC_` for future flexibility
- Added support for three environment variables:
  * `AI_MODEL` - Override the AI model (default: claude-3-5-haiku-20241022)
  * `AI_MAX_TOKENS` - Override max response tokens (no default, uses SDK default)
  * `AI_TEMPERATURE` - Override temperature (default: 0 for consistency)
- Validated at construction time with helpful error messages
- max_tokens only passed to SDK if explicitly set by user

### Security Guidelines
- Enhanced system prompt with explicit security guidelines:
  * Only research official API documentation websites
  * Focus on trusted domains (docs.*, api.*, developer.*, *.dev)
  * No user-generated content or forums
  * No executable code in configurations
  * All sensitive values must use ${ENV_VAR_NAME} format
- Added note about including documentation URLs in prompts for best results

### Enhanced Validation
- Added `performSecurityValidation()` method to check:
  * Base URLs must use HTTPS (not HTTP)
  * Authentication tokens must use ${ENV_VAR} format
  * No hardcoded secrets in headers (checks for auth/key/token headers)
- Validation happens after schema validation, before returning config
- Clear error messages guide users to fix security issues

### TypeScript Considerations
- Used `Anthropic.MessageCreateParamsNonStreaming` type for clarity
- Had to cast response to `Anthropic.Message` due to union type
- max_tokens is required by the type, so we default to 4096 if not specified

### Testing Approach
- Added tests for all environment variable configurations
- Added tests for security validation (HTTP URLs, hardcoded tokens)
- Tests verify that environment variables are properly used in API calls
- All existing tests updated to expect new default model and max_tokens
