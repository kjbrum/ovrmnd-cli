# Task: Implement Validate Command

## Overview

Create the `validate` command to check YAML configuration files for syntax errors, schema compliance, and common issues before attempting to use them.

## Requirements

1. **Syntax Validation**
   - Valid YAML syntax
   - Proper indentation
   - No duplicate keys
   - Valid data types

2. **Schema Validation**
   - Required fields present
   - Valid field values
   - Proper authentication config
   - Valid HTTP methods

3. **Semantic Validation**
   - Path parameter conflicts
   - Alias references valid endpoints
   - Environment variables exist (warning)
   - No circular dependencies

4. **Reporting**
   - Clear error messages with line numbers
   - Warnings vs errors distinction
   - Summary of validation results
   - Suggestions for fixes

## Implementation Steps

### 1. Validate Command
```typescript
// src/commands/validate.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';
import { ConfigValidator } from '@config/validator';
import { ConfigDiscovery } from '@config/discovery';
import { OutputFormatter } from '@utils/output';
import { createLogger } from '@utils/logger';
import * as path from 'path';

const logger = createLogger('validate-command');

interface ValidateArgs {
  service?: string;
  file?: string;
  strict?: boolean;
  json?: boolean;
}

export class ValidateCommand extends BaseCommand<ValidateArgs> {
  command = 'validate [service]';
  describe = 'Validate service configuration files';
  
  builder(yargs: Argv): Argv<ValidateArgs> {
    return yargs
      .positional('service', {
        describe: 'Service name to validate (validates all if omitted)',
        type: 'string',
      })
      .option('file', {
        alias: 'f',
        describe: 'Validate a specific file',
        type: 'string',
      })
      .option('strict', {
        describe: 'Treat warnings as errors',
        type: 'boolean',
        default: false,
      })
      .example('$0 validate', 'Validate all service configs')
      .example('$0 validate github', 'Validate GitHub config')
      .example('$0 validate -f ./my-service.yaml', 'Validate specific file');
  }
  
  async handler(args: Arguments<ValidateArgs>): Promise<void> {
    try {
      const formatter = new OutputFormatter(args.json);
      const validator = new ConfigValidator({ strict: args.strict });
      
      let results: ValidationResult[];
      
      if (args.file) {
        results = [await validator.validateFile(args.file)];
      } else {
        const discovery = new ConfigDiscovery();
        const files = await discovery.discoverYamlFiles();
        
        if (args.service) {
          // Filter files for the specific service
          const filtered = await this.filterByService(files, args.service);
          results = await validator.validateFiles(filtered);
        } else {
          results = await validator.validateFiles(files);
        }
      }
      
      this.displayResults(results, formatter, args.strict);
      
      // Exit with error code if validation failed
      const hasErrors = results.some(r => r.errors.length > 0);
      const hasWarnings = results.some(r => r.warnings.length > 0);
      
      if (hasErrors || (args.strict && hasWarnings)) {
        process.exit(1);
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private async filterByService(files: string[], serviceName: string): Promise<string[]> {
    // Simple filter by filename, could be enhanced to peek into files
    return files.filter(file => {
      const basename = path.basename(file, path.extname(file));
      return basename.toLowerCase() === serviceName.toLowerCase();
    });
  }
  
  private displayResults(
    results: ValidationResult[],
    formatter: OutputFormatter,
    strict: boolean
  ): void {
    if (formatter.isJson()) {
      console.log(formatter.format({ results }));
      return;
    }
    
    let totalErrors = 0;
    let totalWarnings = 0;
    
    results.forEach(result => {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      
      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(`✓ ${result.file}: Valid`);
      } else {
        console.log(`\n${result.file}:`);
        
        result.errors.forEach(error => {
          console.log(`  ✖ Error: ${error.message}`);
          if (error.line) {
            console.log(`    Line ${error.line}: ${error.context}`);
          }
          if (error.suggestion) {
            console.log(`    Suggestion: ${error.suggestion}`);
          }
        });
        
        result.warnings.forEach(warning => {
          const prefix = strict ? '✖' : '⚠';
          console.log(`  ${prefix} Warning: ${warning.message}`);
          if (warning.line) {
            console.log(`    Line ${warning.line}: ${warning.context}`);
          }
          if (warning.suggestion) {
            console.log(`    Suggestion: ${warning.suggestion}`);
          }
        });
      }
    });
    
    console.log('\nSummary:');
    console.log(`  Files validated: ${results.length}`);
    console.log(`  Errors: ${totalErrors}`);
    console.log(`  Warnings: ${totalWarnings}`);
    
    if (totalErrors > 0) {
      console.log('\n✖ Validation failed');
    } else if (totalWarnings > 0 && strict) {
      console.log('\n✖ Validation failed (strict mode)');
    } else {
      console.log('\n✓ Validation passed');
    }
  }
}
```

### 2. Config Validator
```typescript
// src/config/validator.ts
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import { ServiceConfig, EndpointConfig, ParameterConfig } from '@types';
import { OvrmndError, ErrorCode } from '@utils/errors';
import Ajv from 'ajv';

export interface ValidationIssue {
  message: string;
  line?: number;
  context?: string;
  suggestion?: string;
}

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidatorOptions {
  strict?: boolean;
  checkEnvVars?: boolean;
}

export class ConfigValidator {
  private ajv: Ajv;
  private options: ValidatorOptions;
  
  constructor(options: ValidatorOptions = {}) {
    this.options = options;
    this.ajv = new Ajv({ allErrors: true });
    this.setupSchemas();
  }
  
  private setupSchemas(): void {
    // Define JSON Schema for validation
    this.ajv.addSchema({
      $id: 'service',
      type: 'object',
      required: ['serviceName', 'baseUrl', 'authentication', 'endpoints'],
      properties: {
        serviceName: { type: 'string', minLength: 1 },
        baseUrl: { type: 'string', format: 'uri' },
        authentication: { $ref: 'auth' },
        endpoints: {
          type: 'array',
          minItems: 1,
          items: { $ref: 'endpoint' }
        },
        aliases: {
          type: 'array',
          items: { $ref: 'alias' }
        }
      }
    });
    
    this.ajv.addSchema({
      $id: 'auth',
      type: 'object',
      required: ['type'],
      properties: {
        type: { enum: ['bearer', 'apiKey'] },
        token: { type: 'string' },
        header: { type: 'string' },
        queryParam: { type: 'string' }
      }
    });
    
    this.ajv.addSchema({
      $id: 'endpoint',
      type: 'object',
      required: ['name', 'method', 'path'],
      properties: {
        name: { type: 'string', minLength: 1 },
        method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        path: { type: 'string', minLength: 1 },
        bodyType: { enum: ['json', 'form'] },
        parameters: {
          type: 'array',
          items: { $ref: 'parameter' }
        },
        cacheTTL: { type: 'number', minimum: 0 },
        transform: { $ref: 'transform' }
      }
    });
    
    // Add more schemas...
  }
  
  async validateFile(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      file: filePath,
      valid: true,
      errors: [],
      warnings: [],
    };
    
    try {
      // Read and parse YAML
      const content = await fs.readFile(filePath, 'utf-8');
      let config: ServiceConfig;
      
      try {
        config = yaml.load(content) as ServiceConfig;
      } catch (yamlError: any) {
        result.valid = false;
        result.errors.push({
          message: `YAML syntax error: ${yamlError.message}`,
          line: yamlError.mark?.line,
          context: yamlError.mark?.snippet,
        });
        return result;
      }
      
      // Schema validation
      const valid = this.ajv.validate('service', config);
      if (!valid) {
        result.valid = false;
        this.ajv.errors?.forEach(error => {
          result.errors.push({
            message: `${error.schemaPath}: ${error.message}`,
            context: JSON.stringify(error.params),
          });
        });
      }
      
      // Semantic validation
      if (config && result.valid) {
        this.validateSemantics(config, result);
      }
      
    } catch (error: any) {
      result.valid = false;
      result.errors.push({
        message: `Failed to read file: ${error.message}`,
      });
    }
    
    return result;
  }
  
  async validateFiles(filePaths: string[]): Promise<ValidationResult[]> {
    return Promise.all(filePaths.map(file => this.validateFile(file)));
  }
  
  private validateSemantics(config: ServiceConfig, result: ValidationResult): void {
    // Check authentication configuration
    this.validateAuthentication(config.authentication, result);
    
    // Check endpoints
    config.endpoints.forEach(endpoint => {
      this.validateEndpoint(endpoint, result);
    });
    
    // Check aliases
    if (config.aliases) {
      this.validateAliases(config.aliases, config.endpoints, result);
    }
    
    // Check for environment variables
    if (this.options.checkEnvVars) {
      this.checkEnvironmentVariables(config, result);
    }
  }
  
  private validateAuthentication(auth: any, result: ValidationResult): void {
    if (auth.type === 'bearer' && !auth.token) {
      result.errors.push({
        message: 'Bearer authentication requires a token field',
        suggestion: 'Add "token: ${YOUR_API_TOKEN}" to authentication',
      });
    }
    
    if (auth.type === 'apiKey' && !auth.header && !auth.queryParam) {
      result.errors.push({
        message: 'API Key authentication requires either header or queryParam',
        suggestion: 'Add either "header: X-API-Key" or "queryParam: api_key"',
      });
    }
  }
  
  private validateEndpoint(endpoint: EndpointConfig, result: ValidationResult): void {
    // Extract path parameters
    const pathParams = new Set<string>();
    const regex = /{([^}]+)}/g;
    let match;
    
    while ((match = regex.exec(endpoint.path)) !== null) {
      pathParams.add(match[1]);
    }
    
    // Check for path parameter conflicts
    endpoint.parameters?.forEach(param => {
      if (pathParams.has(param.name) && param.type !== 'path') {
        result.errors.push({
          message: `Parameter '${param.name}' is used in path but defined as ${param.type}`,
          context: `Endpoint: ${endpoint.name}`,
          suggestion: `Remove the parameter definition or change type to 'path'`,
        });
      }
      
      if (param.type === 'path' && !pathParams.has(param.name)) {
        result.warnings.push({
          message: `Path parameter '${param.name}' is not used in the path`,
          context: `Endpoint: ${endpoint.name}`,
        });
      }
    });
    
    // Validate body parameters for GET requests
    if (endpoint.method === 'GET' && endpoint.parameters?.some(p => p.type === 'body')) {
      result.warnings.push({
        message: `GET requests should not have body parameters`,
        context: `Endpoint: ${endpoint.name}`,
        suggestion: 'Use query parameters instead',
      });
    }
  }
  
  private validateAliases(
    aliases: any[],
    endpoints: EndpointConfig[],
    result: ValidationResult
  ): void {
    const endpointNames = new Set(endpoints.map(e => e.name));
    
    aliases.forEach(alias => {
      if (!endpointNames.has(alias.endpoint)) {
        result.errors.push({
          message: `Alias '${alias.name}' references unknown endpoint '${alias.endpoint}'`,
          suggestion: `Available endpoints: ${Array.from(endpointNames).join(', ')}`,
        });
      }
    });
  }
  
  private checkEnvironmentVariables(config: ServiceConfig, result: ValidationResult): void {
    const envVarRegex = /\${([^}]+)}/g;
    const configStr = JSON.stringify(config);
    let match;
    
    while ((match = envVarRegex.exec(configStr)) !== null) {
      const varName = match[1];
      if (!process.env[varName]) {
        result.warnings.push({
          message: `Environment variable '${varName}' is not set`,
          suggestion: `Set ${varName} in your environment or .env file`,
        });
      }
    }
  }
}
```

## Testing Strategy

1. **Valid Config Tests**
   - Test with complete valid configuration
   - Test with minimal valid configuration
   - Test with all optional fields

2. **Invalid Config Tests**
   - Missing required fields
   - Invalid field types
   - Invalid enum values
   - Malformed YAML

3. **Semantic Tests**
   - Path parameter conflicts
   - Invalid alias references
   - Body parameters on GET requests
   - Missing environment variables

## Success Criteria

- [ ] Detects YAML syntax errors with line numbers
- [ ] Validates against schema requirements
- [ ] Catches semantic issues (parameter conflicts)
- [ ] Provides helpful error messages
- [ ] Distinguishes warnings from errors
- [ ] Strict mode treats warnings as errors

## Dependencies

```bash
npm install ajv
npm install --save-dev @types/js-yaml
```

## Common Issues

1. **Line Numbers**: YAML parsers may not provide accurate line numbers
2. **Schema Evolution**: Keep schemas updated with new features
3. **Performance**: Large configs may take time to validate
4. **Error Messages**: Make them actionable, not just descriptive