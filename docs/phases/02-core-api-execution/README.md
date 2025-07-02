# Phase 2: Core API Execution

## Overview

This phase implements the core functionality of Ovrmnd CLI - the ability to make API calls based on YAML configurations. This is the heart of the tool and delivers the minimum viable product (MVP) functionality.

## Objectives

1. Build a robust YAML configuration engine with discovery and validation
2. Implement authentication mechanisms (Bearer Token, API Key)
3. Create the `call` command for executing API requests
4. Support both human-friendly and machine-readable (JSON) output modes
5. Provide standardized error handling for LLM consumption

## Key Deliverables

- YAML parsing and validation system
- Configuration discovery (global and local)
- HTTP request execution with proper authentication
- Dual-mode output system
- Comprehensive error handling

## Architecture Decisions

### Configuration Management
- Global configs in `~/.ovrmnd/`
- Local configs in `./.ovrmnd/`
- Local overrides global for same service name
- Environment variable resolution with `${VAR_NAME}` syntax

### YAML Schema Design
```yaml
serviceName: github
baseUrl: https://api.github.com
authentication:
  type: bearer  # or 'apiKey'
  token: ${GITHUB_TOKEN}
endpoints:
  - name: get-user
    method: GET
    path: /users/{username}  # Auto-detected as required param
    cacheTTL: 300
  - name: create-issue
    method: POST
    path: /repos/{owner}/{repo}/issues
    bodyType: json
    parameters:
      - name: title
        type: body
        required: true
      - name: body
        type: body
        required: false
```

### Parameter Resolution
1. Path parameters extracted from URL template
2. CLI arguments mapped based on parameter definitions
3. Body parameters combined into request body
4. Query parameters appended to URL
5. Header parameters added to request headers

### Output Modes
- **Default (Human)**: Formatted console output with colors
- **JSON Mode** (`--json`): Clean JSON for LLM parsing
- **Debug Mode** (`--debug`): Verbose logging to stderr

## Technical Considerations

### Path Parameter Detection
- Regex pattern: `/{([^/}]+)}/g`
- Automatically marked as required
- Cannot be redefined in parameters list

### Error Schema
```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication failed",
    "details": {
      "status": 401,
      "response": {}
    }
  }
}
```

### Security
- Never log sensitive data (tokens, passwords)
- Environment variables only for secrets
- Validate against hardcoded secrets in YAML

## Dependencies

- `js-yaml`: YAML parsing
- `node-fetch` or native `fetch`: HTTP requests
- `joi` or `zod`: Schema validation (optional)

## Success Criteria

- [ ] Can parse and validate YAML configurations
- [ ] Can discover configs from global and local directories
- [ ] Can make authenticated API calls
- [ ] Can handle all parameter types (path, query, body, header)
- [ ] JSON output mode works correctly for LLMs
- [ ] Errors are properly formatted in JSON mode
- [ ] Environment variables are resolved correctly
- [ ] Local configs override global configs