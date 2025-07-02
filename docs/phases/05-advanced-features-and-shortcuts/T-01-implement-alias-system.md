# Task: Implement Alias System

## Overview

Build an alias system that allows users to define shortcuts with preconfigured arguments for common API calls, reducing complexity for both humans and LLMs.

## Requirements

1. **Alias Definition**
   - Reference existing endpoints
   - Preconfigure arguments
   - Support descriptions
   - Allow argument overrides

2. **Alias Resolution**
   - Map alias to endpoint
   - Merge preconfigured args with CLI args
   - CLI args override alias defaults
   - Validate against endpoint requirements

3. **Alias Discovery**
   - List available aliases
   - Show configured arguments
   - Display in help text

4. **Validation**
   - Ensure aliases reference valid endpoints
   - Check argument compatibility
   - Warn about missing required args

## Implementation Steps

### 1. Alias Types and Schema
```typescript
// src/types/config.ts (additions)
export interface AliasConfig {
  name: string;
  endpoint: string;
  args: Record<string, any>;
  description?: string;
  hidden?: boolean; // Hide from listings
}

export interface ResolvedAlias {
  alias: AliasConfig;
  endpoint: EndpointConfig;
  service: ServiceConfig;
  mergedArgs: Record<string, any>;
}
```

### 2. Alias Resolver
```typescript
// src/config/alias-resolver.ts
import { AliasConfig, EndpointConfig, ServiceConfig, ResolvedAlias } from '@types';
import { OvrmndError, ErrorCode } from '@utils/errors';
import { createLogger } from '@utils/logger';
import { ParameterValidator } from './parameter-validator';

const logger = createLogger('alias-resolver');

export class AliasResolver {
  private services: Map<string, ServiceConfig>;
  
  constructor(services: Map<string, ServiceConfig>) {
    this.services = services;
  }
  
  resolve(
    serviceName: string,
    aliasName: string,
    cliArgs: Record<string, any> = {}
  ): ResolvedAlias {
    // Find service
    const service = this.services.get(serviceName);
    if (!service) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_NOT_FOUND,
        message: `Service '${serviceName}' not found`,
      });
    }
    
    // Find alias
    const alias = service.aliases?.find(a => a.name === aliasName);
    if (!alias) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_NOT_FOUND,
        message: `Alias '${aliasName}' not found in service '${serviceName}'`,
        help: this.getAvailableAliases(service),
      });
    }
    
    // Find referenced endpoint
    const endpoint = service.endpoints.find(e => e.name === alias.endpoint);
    if (!endpoint) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Alias '${aliasName}' references unknown endpoint '${alias.endpoint}'`,
      });
    }
    
    // Merge arguments (CLI overrides alias defaults)
    const mergedArgs = this.mergeArguments(alias.args, cliArgs);
    
    logger.debug('Alias resolved', {
      service: serviceName,
      alias: aliasName,
      endpoint: endpoint.name,
      aliasArgs: alias.args,
      cliArgs,
      mergedArgs,
    });
    
    return {
      alias,
      endpoint,
      service,
      mergedArgs,
    };
  }
  
  validateAlias(
    service: ServiceConfig,
    alias: AliasConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check endpoint exists
    const endpoint = service.endpoints.find(e => e.name === alias.endpoint);
    if (!endpoint) {
      errors.push(`Endpoint '${alias.endpoint}' not found`);
      return { valid: false, errors };
    }
    
    // Validate arguments against endpoint parameters
    const validator = new ParameterValidator();
    const validation = validator.validateArguments(
      endpoint,
      alias.args,
      { partial: true } // Allow partial args in alias
    );
    
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  private mergeArguments(
    aliasArgs: Record<string, any>,
    cliArgs: Record<string, any>
  ): Record<string, any> {
    // Deep merge with CLI args taking precedence
    const merged = JSON.parse(JSON.stringify(aliasArgs)); // Deep clone
    
    for (const [key, value] of Object.entries(cliArgs)) {
      if (value !== undefined) {
        // Handle nested objects
        if (typeof value === 'object' && 
            value !== null && 
            !Array.isArray(value) &&
            typeof merged[key] === 'object' &&
            merged[key] !== null &&
            !Array.isArray(merged[key])) {
          merged[key] = { ...merged[key], ...value };
        } else {
          merged[key] = value;
        }
      }
    }
    
    return merged;
  }
  
  private getAvailableAliases(service: ServiceConfig): string {
    if (!service.aliases || service.aliases.length === 0) {
      return 'No aliases defined for this service';
    }
    
    const aliases = service.aliases
      .filter(a => !a.hidden)
      .map(a => a.name)
      .join(', ');
    
    return `Available aliases: ${aliases}`;
  }
}
```

### 3. Parameter Validator
```typescript
// src/config/parameter-validator.ts
import { EndpointConfig, ParameterConfig } from '@types';
import { createLogger } from '@utils/logger';

const logger = createLogger('parameter-validator');

interface ValidationOptions {
  partial?: boolean; // Allow missing required params
  strict?: boolean;  // Disallow extra params
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
  extra: string[];
}

export class ParameterValidator {
  validateArguments(
    endpoint: EndpointConfig,
    args: Record<string, any>,
    options: ValidationOptions = {}
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missing: [],
      extra: [],
    };
    
    // Build parameter map including path params
    const parameters = this.buildParameterMap(endpoint);
    
    // Check required parameters
    for (const [name, param] of parameters.entries()) {
      if (param.required && !(name in args)) {
        if (options.partial) {
          result.warnings.push(`Required parameter '${name}' not provided (will need to be supplied)`);
        } else {
          result.errors.push(`Required parameter '${name}' is missing`);
          result.missing.push(name);
          result.valid = false;
        }
      }
    }
    
    // Check for extra parameters
    for (const argName of Object.keys(args)) {
      if (!parameters.has(argName)) {
        if (options.strict) {
          result.errors.push(`Unknown parameter '${argName}'`);
          result.extra.push(argName);
          result.valid = false;
        } else {
          result.warnings.push(`Unknown parameter '${argName}' will be ignored`);
          result.extra.push(argName);
        }
      }
    }
    
    // Validate parameter types and values
    for (const [name, value] of Object.entries(args)) {
      const param = parameters.get(name);
      if (param) {
        this.validateParameterValue(name, value, param, result);
      }
    }
    
    return result;
  }
  
  private buildParameterMap(endpoint: EndpointConfig): Map<string, ParameterConfig> {
    const params = new Map<string, ParameterConfig>();
    
    // Extract path parameters
    const pathParams = this.extractPathParameters(endpoint.path);
    pathParams.forEach(name => {
      params.set(name, {
        name,
        type: 'path',
        required: true,
      });
    });
    
    // Add defined parameters
    endpoint.parameters?.forEach(param => {
      if (params.has(param.name) && param.type === 'path') {
        logger.warn('Path parameter redefined', { endpoint: endpoint.name, param: param.name });
      } else {
        params.set(param.name, param);
      }
    });
    
    return params;
  }
  
  private extractPathParameters(path: string): string[] {
    const params: string[] = [];
    const regex = /{([^}]+)}/g;
    let match;
    
    while ((match = regex.exec(path)) !== null) {
      params.push(match[1]);
    }
    
    return params;
  }
  
  private validateParameterValue(
    name: string,
    value: any,
    param: ParameterConfig,
    result: ValidationResult
  ): void {
    // Type validation if schema is provided
    if (param.schema) {
      // This would integrate with a JSON Schema validator
      // For now, basic type checking
      const expectedType = param.schema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (expectedType && expectedType !== actualType) {
        result.errors.push(
          `Parameter '${name}' expected type '${expectedType}' but got '${actualType}'`
        );
        result.valid = false;
      }
    }
    
    // Custom validations based on parameter type
    if (param.type === 'path' && typeof value !== 'string') {
      result.errors.push(`Path parameter '${name}' must be a string`);
      result.valid = false;
    }
  }
}
```

### 4. Call Command Enhancement
```typescript
// src/commands/call.ts (enhanced)
export class CallCommand extends BaseCommand<CallArgs> {
  async handler(args: Arguments<CallArgs>): Promise<void> {
    try {
      const [serviceName, targetName] = args.service.split('.');
      
      if (!targetName) {
        throw new Error('Invalid format. Use: service.endpoint or service.alias');
      }
      
      const registry = await ServiceRegistry.load();
      const service = registry.getService(serviceName);
      
      if (!service) {
        throw new Error(`Service '${serviceName}' not found`);
      }
      
      // Extract CLI arguments
      const cliArgs = this.extractArguments(args);
      
      // Try to resolve as alias first
      let endpoint: EndpointConfig;
      let finalArgs: Record<string, any>;
      
      const aliasResolver = new AliasResolver(registry.getServices());
      
      try {
        const resolved = aliasResolver.resolve(serviceName, targetName, cliArgs);
        endpoint = resolved.endpoint;
        finalArgs = resolved.mergedArgs;
        
        logger.info('Using alias', {
          alias: targetName,
          endpoint: endpoint.name,
        });
      } catch (error) {
        // Not an alias, try as endpoint
        endpoint = service.endpoints.find(e => e.name === targetName);
        if (!endpoint) {
          throw new Error(
            `'${targetName}' is neither an alias nor an endpoint in ${serviceName}`
          );
        }
        finalArgs = cliArgs;
      }
      
      // Validate final arguments
      const validator = new ParameterValidator();
      const validation = validator.validateArguments(endpoint, finalArgs);
      
      if (!validation.valid) {
        throw new Error(`Invalid arguments:\n${validation.errors.join('\n')}`);
      }
      
      // Execute API call
      const context = {
        service,
        endpoint,
        args: finalArgs,
        options: {
          json: args.json,
          debug: args.debug,
        },
      };
      
      const client = new ApiClient();
      const response = await client.execute(context);
      
      // Output response
      this.outputResponse(response, args.json);
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private extractArguments(args: Arguments<CallArgs>): Record<string, any> {
    const extracted: Record<string, any> = {};
    
    // Remove known yargs properties
    const yargsKeys = ['_', '$0', 'service', 'json', 'debug', 'help', 'version'];
    
    for (const [key, value] of Object.entries(args)) {
      if (!yargsKeys.includes(key)) {
        extracted[key] = value;
      }
    }
    
    return extracted;
  }
}
```

### 5. YAML Configuration Examples
```yaml
serviceName: github
baseUrl: https://api.github.com
authentication:
  type: bearer
  token: ${GITHUB_TOKEN}

endpoints:
  - name: get-user
    method: GET
    path: /users/{username}
    
  - name: create-issue
    method: POST
    path: /repos/{owner}/{repo}/issues
    parameters:
      - name: title
        type: body
        required: true
      - name: body
        type: body
        required: false
      - name: labels
        type: body
        required: false

aliases:
  # Simple alias with fixed username
  - name: my-profile
    endpoint: get-user
    args:
      username: octocat
    description: Get my GitHub profile
    
  # Alias with partial args for creating bug reports
  - name: bug-report
    endpoint: create-issue
    args:
      owner: myorg
      repo: myproject
      labels: ["bug", "needs-triage"]
    description: Create a bug report in myproject
    
  # Hidden utility alias
  - name: internal-api-check
    endpoint: get-user
    args:
      username: github
    hidden: true
```

### 6. Usage Examples
```bash
# Use alias with defaults
ovrmnd call github.my-profile

# Override alias arguments
ovrmnd call github.my-profile --username=different-user

# Use bug report alias
ovrmnd call github.bug-report --title="Login broken" --body="Cannot log in"

# List aliases to see what's available
ovrmnd list aliases github
```

## Testing Strategy

1. **Alias Resolution Tests**
   - Valid alias resolution
   - Invalid alias/endpoint references
   - Argument merging logic
   - Deep merge scenarios

2. **Validation Tests**
   - Partial argument validation
   - Type checking
   - Required parameter handling

3. **Integration Tests**
   - End-to-end alias usage
   - Complex argument structures
   - Error scenarios

## Success Criteria

- [ ] Aliases can reference valid endpoints
- [ ] Arguments merge correctly (CLI overrides)
- [ ] Validation works for partial args
- [ ] Hidden aliases don't show in listings
- [ ] Error messages are helpful
- [ ] Works seamlessly with call command

## Common Issues

1. **Argument Parsing**: Complex nested arguments
2. **Validation**: Partial vs complete validation
3. **Discovery**: Making aliases discoverable
4. **Naming Conflicts**: Alias vs endpoint names