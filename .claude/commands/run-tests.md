# Run Tests Command

<goal>
Execute all automated test suites and perform comprehensive manual CLI testing to ensure the Ovrmnd CLI is functioning correctly with no regressions.
</goal>

<instructions>
This command runs both automated tests and guides through manual CLI testing using the testing.yaml configuration.

## 1. **Run Automated Test Suites**

Execute all unit and integration tests with coverage:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run tests in watch mode for development
npm test -- --watch

# Run specific test file
npm test tests/commands/call.test.ts
```

Expected output:
- All test suites should pass (currently 80+ tests)
- Coverage should be above 80%

**IMPORTANT NOTE**: Some tests that use `process.exit()` may show warnings like:
```
●  process.exit called with "1"
```
This is a known Jest limitation when testing process.exit calls. These warnings can be ignored - the tests are still passing correctly. The issue is documented in LEARNINGS.md. As long as the test assertions pass (green checkmarks), consider the tests successful.

## 2. **Run Code Quality Checks**

Ensure code meets quality standards:

```bash
# Run ESLint
npm run lint

# Run TypeScript type checking
npm run typecheck

# Run Prettier formatting check
npm run format

# Build the project
npm run build
```

All commands should complete without errors.

## 3. **Manual CLI Testing - Basic Functionality**

Test core CLI features using the testing.yaml configuration:

### 3.1 Basic API Calls
```bash
# List all users (array response)
node dist/cli.js call testing.listUsers

# Get specific user (path parameter)
node dist/cli.js call testing.getUser id=1

# Use alias
node dist/cli.js call testing.me

# Pretty output mode (human-readable)
node dist/cli.js call testing.listUsers --pretty
```

### 3.2 Parameter Types
```bash
# Query parameters with defaults
node dist/cli.js call testing.listPosts

# Override default parameters
node dist/cli.js call testing.listPosts _limit=5

# Multiple path parameters
node dist/cli.js call testing.getComment postId=1 id=1

# POST with body parameters
node dist/cli.js call testing.createUser name="Test User" email="test@example.com"

# Explicit parameter types
node dist/cli.js call testing.listUsers --query _limit=2 --header X-Test=value
```

### 3.3 Error Cases
```bash
# Invalid target format
node dist/cli.js call testing

# Non-existent endpoint
node dist/cli.js call testing.nonexistent

# Missing required parameter
node dist/cli.js call testing.getUser

# Invalid service
node dist/cli.js call invalid.endpoint
```

## 4. **Verify Output Formats**

### 4.1 JSON Output (Default)
```bash
# Verify clean JSON output (no debug logs)
node dist/cli.js call testing.me | jq .

# Verify error format in JSON mode
node dist/cli.js call testing.nonexistent 2>&1 | jq .
```

### 4.2 Human-Friendly Output (--pretty flag)
- Tables for arrays
- Colored output (errors in red, success in green)
- Nested object formatting
- Clear error messages with help text

```bash
# Verify pretty output
node dist/cli.js call testing.listUsers --pretty
```

## 5. **Debug Mode Testing**

Test verbose debug output:

```bash
# Enable debug logging
node dist/cli.js call testing.listUsers --debug 2>&1 | grep DEBUG

# Should show:
# - Config loading
# - Parameter mapping
# - Request details
# - Response info
```

## 6. **Authentication Testing** (when implemented)

If authentication is configured in testing.yaml:

```bash
# Set test token
export TEST_API_TOKEN="test-token-123"

# Verify auth header is applied
node dist/cli.js call testing.listUsers --debug 2>&1 | grep "Authorization"
```

## 7. **Help System Verification**

```bash
# General help
node dist/cli.js --help

# Command-specific help
node dist/cli.js call --help

# Verify examples use correct syntax (service.endpoint)
```

## 8. **Performance Check**

```bash
# Time a simple request
time node dist/cli.js call testing.me --json > /dev/null

# Should complete in under 2 seconds for local API
```

## 9. **Review Test Configuration**

Ensure `.ovrmnd/testing.yaml` is up to date:
- Includes all endpoint types (GET, POST, PUT, DELETE)
- Has examples of all parameter types
- Includes aliases with various patterns
- Documents new YAML features as they're added

</instructions>

<additional_notes>
- Run this command after any significant changes to the CLI
- If any test fails, fix the issue before committing
- Update testing.yaml when adding new configuration features
- Consider adding new test cases for new functionality
- The testing API (jsonplaceholder.typicode.com) is a free service, be respectful of rate limits
- For debugging test failures, use `--debug` flag or check specific test output
- Keep this command updated as new features are added to the CLI
</additional_notes>
