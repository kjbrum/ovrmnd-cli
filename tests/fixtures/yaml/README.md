# Test YAML Fixtures

This directory contains YAML configuration files specifically designed for testing validation errors and edge cases.

## Test Files

### invalid-test.yaml
- Contains various validation errors such as:
  - Missing required fields (baseUrl)
  - Duplicate path parameters
  - Invalid cache TTL values
  - Duplicate endpoint names
  - Auth header conflicts
  - Invalid alias references

### syntax-error.yaml
- Contains YAML syntax errors such as:
  - Wrong indentation
  - Missing colons
  - Malformed structure

### semantic-test.yaml
- Contains semantic validation warnings such as:
  - Environment variables that may not be set
  - Cache TTL on non-GET endpoints
  - Path/query parameter conflicts
  - Missing required parameters in aliases

## Usage

To test the validate command with these files:

```bash
# Validate a specific test file
ovrmnd validate --file tests/fixtures/yaml/invalid-test.yaml

# Validate with human-readable output
ovrmnd validate --file tests/fixtures/yaml/syntax-error.yaml --pretty

# Run with strict mode to treat warnings as errors
ovrmnd validate --file tests/fixtures/yaml/semantic-test.yaml --strict

# Validate all test files (need to run each individually)
ovrmnd validate --file tests/fixtures/yaml/invalid-test.yaml
ovrmnd validate --file tests/fixtures/yaml/syntax-error.yaml
ovrmnd validate --file tests/fixtures/yaml/semantic-test.yaml
```

These files are intentionally invalid and should not be placed in the `.ovrmnd/` directory as they will cause errors during normal config discovery.