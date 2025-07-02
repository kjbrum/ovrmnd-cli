# Task: Implement Test Command

## Overview

Create the `test` command that performs dry-run API calls to validate configuration and connectivity without side effects or caching.

## Requirements

1. **Test Execution**
   - Make real API calls (GET requests safe)
   - Skip caching for test calls
   - Validate authentication
   - Check connectivity

2. **Safety Measures**
   - Warn before non-GET requests
   - Option to skip actual execution
   - No state changes in cache
   - Clear test indication

3. **Validation Output**
   - Connection success/failure
   - Authentication validation
   - Response time measurement
   - Basic response validation

4. **Test Modes**
   - Quick connectivity check
   - Full request/response test
   - Authentication-only test
   - Batch testing multiple endpoints

## Implementation Steps

### 1. Test Command Implementation
```typescript
// src/commands/test.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';
import { ServiceRegistry } from '@config/registry';
import { ApiClient } from '@api/client';
import { AliasResolver } from '@config/alias-resolver';
import { ParameterValidator } from '@config/parameter-validator';
import { OutputFormatter } from '@utils/output';
import { createLogger } from '@utils/logger';
import * as prompts from 'prompts';
import chalk from 'chalk';

const logger = createLogger('test-command');

interface TestArgs {
  target: string;
  mode?: 'quick' | 'full' | 'auth';
  skipExecution?: boolean;
  force?: boolean;
  json?: boolean;
  timeout?: number;
  [key: string]: any; // Dynamic arguments
}

interface TestResult {
  target: string;
  success: boolean;
  duration: number;
  status?: number;
  error?: string;
  warnings: string[];
  details: {
    service: string;
    endpoint: string;
    method: string;
    url: string;
    authenticated: boolean;
  };
}

export class TestCommand extends BaseCommand<TestArgs> {
  command = 'test <target>';
  describe = 'Test API endpoint connectivity and configuration';
  
  builder(yargs: Argv): Argv<TestArgs> {
    return yargs
      .positional('target', {
        describe: 'Service.endpoint or service.alias to test',
        type: 'string',
        demandOption: true,
      })
      .option('mode', {
        describe: 'Test mode',
        choices: ['quick', 'full', 'auth'] as const,
        default: 'full',
      })
      .option('skip-execution', {
        describe: 'Validate only, skip actual API call',
        type: 'boolean',
        default: false,
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation for non-GET requests',
        type: 'boolean',
        default: false,
      })
      .option('timeout', {
        describe: 'Request timeout in milliseconds',
        type: 'number',
        default: 10000,
      })
      .strict(false) // Allow dynamic arguments
      .example('$0 test github.get-user --username=octocat', 'Test GitHub user endpoint')
      .example('$0 test slack.post-message --skip-execution', 'Validate without calling')
      .example('$0 test shopify.my-products --mode=quick', 'Quick connectivity test');
  }
  
  async handler(args: Arguments<TestArgs>): Promise<void> {
    try {
      const formatter = new OutputFormatter(args.json);
      const startTime = Date.now();
      
      // Parse target
      const [serviceName, targetName] = args.target.split('.');
      if (!targetName) {
        throw new Error('Invalid format. Use: service.endpoint or service.alias');
      }
      
      // Load configuration
      const registry = await ServiceRegistry.load();
      const service = registry.getService(serviceName);
      
      if (!service) {
        throw new Error(`Service '${serviceName}' not found`);
      }
      
      // Resolve endpoint (could be alias)
      const { endpoint, finalArgs } = await this.resolveTarget(
        registry,
        serviceName,
        targetName,
        this.extractArguments(args)
      );
      
      // Build test result
      const result: TestResult = {
        target: args.target,
        success: false,
        duration: 0,
        warnings: [],
        details: {
          service: serviceName,
          endpoint: endpoint.name,
          method: endpoint.method,
          url: this.buildUrl(service, endpoint, finalArgs),
          authenticated: !!service.authentication,
        },
      };
      
      // Validate configuration
      const validation = this.validateConfiguration(service, endpoint, finalArgs);
      result.warnings.push(...validation.warnings);
      
      if (!validation.valid) {
        result.error = validation.errors.join('; ');
        this.outputResult(result, formatter);
        return;
      }
      
      // Check for non-GET confirmation
      if (endpoint.method !== 'GET' && !args.skipExecution && !args.force) {
        const confirmed = await this.confirmNonGetRequest(endpoint, formatter);
        if (!confirmed) {
          result.error = 'Test cancelled by user';
          this.outputResult(result, formatter);
          return;
        }
      }
      
      // Execute test based on mode
      if (args.skipExecution) {
        result.success = true;
        result.error = 'Validation only - no API call made';
      } else {
        await this.executeTest(
          service,
          endpoint,
          finalArgs,
          args.mode || 'full',
          args.timeout || 10000,
          result
        );
      }
      
      result.duration = Date.now() - startTime;
      this.outputResult(result, formatter);
      
      // Exit with error code if test failed
      if (!result.success) {
        process.exit(1);
      }
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private async resolveTarget(
    registry: ServiceRegistry,
    serviceName: string,
    targetName: string,
    cliArgs: Record<string, any>
  ): Promise<{ endpoint: any; finalArgs: Record<string, any> }> {
    const service = registry.getService(serviceName)!;
    
    // Try alias first
    try {
      const aliasResolver = new AliasResolver(registry.getServices());
      const resolved = aliasResolver.resolve(serviceName, targetName, cliArgs);
      return {
        endpoint: resolved.endpoint,
        finalArgs: resolved.mergedArgs,
      };
    } catch {
      // Not an alias, try endpoint
      const endpoint = service.endpoints.find(e => e.name === targetName);
      if (!endpoint) {
        throw new Error(`'${targetName}' not found in ${serviceName}`);
      }
      return { endpoint, finalArgs: cliArgs };
    }
  }
  
  private validateConfiguration(
    service: any,
    endpoint: any,
    args: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check authentication
    if (service.authentication) {
      if (!process.env[service.authentication.token?.replace(/\${|}$/g, '')]) {
        warnings.push('Authentication token environment variable not set');
      }
    }
    
    // Validate parameters
    const validator = new ParameterValidator();
    const validation = validator.validateArguments(endpoint, args);
    
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    warnings.push(...validation.warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  private async confirmNonGetRequest(
    endpoint: any,
    formatter: OutputFormatter
  ): Promise<boolean> {
    if (formatter.isJson()) {
      return true; // Skip confirmation in JSON mode
    }
    
    console.log(chalk.yellow(`\n⚠️  This will execute a ${endpoint.method} request`));
    console.log('This may cause side effects (create/update/delete data).\n');
    
    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Continue with test?',
      initial: false,
    });
    
    return response.confirm;
  }
  
  private async executeTest(
    service: any,
    endpoint: any,
    args: Record<string, any>,
    mode: 'quick' | 'full' | 'auth',
    timeout: number,
    result: TestResult
  ): Promise<void> {
    try {
      const client = new ApiClient({
        timeout,
        testMode: true, // Disable caching
      });
      
      if (mode === 'auth') {
        // Just test authentication
        const authTest = await client.testAuthentication(service);
        result.success = authTest.success;
        if (!authTest.success) {
          result.error = authTest.error;
        }
        return;
      }
      
      // Execute request
      const context = {
        service,
        endpoint,
        args,
        options: {
          noCache: true,
          timeout,
          testMode: true,
        },
      };
      
      const response = await client.execute(context);
      
      result.success = response.success;
      result.status = response.metadata?.statusCode;
      
      if (!response.success) {
        result.error = response.error?.message || 'Request failed';
      }
      
      if (mode === 'full' && response.success) {
        // Additional validation for full mode
        this.validateResponse(response.data, endpoint, result);
      }
      
    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      
      if (error.code === 'ECONNREFUSED') {
        result.error = 'Connection refused - service may be down';
      } else if (error.code === 'ETIMEDOUT') {
        result.error = 'Request timed out';
      }
    }
  }
  
  private validateResponse(data: any, endpoint: any, result: TestResult): void {
    // Basic response validation
    if (data === null || data === undefined) {
      result.warnings.push('Response body is empty');
    }
    
    if (endpoint.transform && endpoint.transform.fields) {
      // Check if expected fields exist
      const missingFields = endpoint.transform.fields.filter(field => {
        const value = this.getNestedValue(data, field);
        return value === undefined;
      });
      
      if (missingFields.length > 0) {
        result.warnings.push(
          `Missing expected fields: ${missingFields.join(', ')}`
        );
      }
    }
  }
  
  private buildUrl(service: any, endpoint: any, args: Record<string, any>): string {
    let url = service.baseUrl + endpoint.path;
    
    // Replace path parameters
    Object.entries(args).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, String(value));
    });
    
    return url;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, part) => curr?.[part], obj);
  }
  
  private extractArguments(args: Arguments<TestArgs>): Record<string, any> {
    const yargsKeys = [
      '_', '$0', 'target', 'mode', 'skipExecution', 'skip-execution',
      'force', 'json', 'timeout', 'help', 'version'
    ];
    
    const extracted: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (!yargsKeys.includes(key)) {
        extracted[key] = value;
      }
    }
    
    return extracted;
  }
  
  private outputResult(result: TestResult, formatter: OutputFormatter): void {
    if (formatter.isJson()) {
      console.log(formatter.format(result));
      return;
    }
    
    // Header
    console.log(`\nTest Results for ${chalk.cyan(result.target)}`);
    console.log('─'.repeat(50));
    
    // Status
    const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗');
    const statusText = result.success ? chalk.green('PASSED') : chalk.red('FAILED');
    console.log(`${statusIcon} Status: ${statusText}`);
    
    // Details
    console.log(`\nDetails:`);
    console.log(`  Service: ${result.details.service}`);
    console.log(`  Endpoint: ${result.details.endpoint}`);
    console.log(`  Method: ${result.details.method}`);
    console.log(`  URL: ${result.details.url}`);
    console.log(`  Authenticated: ${result.details.authenticated ? 'Yes' : 'No'}`);
    
    // Timing
    console.log(`  Duration: ${result.duration}ms`);
    
    if (result.status) {
      console.log(`  HTTP Status: ${result.status}`);
    }
    
    // Error
    if (result.error) {
      console.log(`\n${chalk.red('Error:')} ${result.error}`);
    }
    
    // Warnings
    if (result.warnings.length > 0) {
      console.log(`\n${chalk.yellow('Warnings:')}`);
      result.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }
    
    console.log('─'.repeat(50));
  }
}
```

### 2. API Client Test Mode
```typescript
// src/api/client.ts (additions)
export interface ClientOptions {
  timeout?: number;
  testMode?: boolean;
  retries?: number;
}

export class ApiClient {
  private options: ClientOptions;
  
  constructor(options: ClientOptions = {}) {
    this.options = options;
  }
  
  async testAuthentication(service: ServiceConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Make a simple authenticated request
      const testUrl = new URL('/', service.baseUrl).toString();
      const headers = this.buildAuthHeaders(service.authentication);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(this.options.timeout || 5000),
      });
      
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: `Authentication failed (HTTP ${response.status})`,
        };
      }
      
      return { success: true };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async execute(context: RequestContext): Promise<ApiResponse> {
    if (this.options.testMode) {
      // Disable caching for test mode
      context.options.noCache = true;
      
      // Add test headers
      if (!context.headers) context.headers = {};
      context.headers['X-Ovrmnd-Test'] = 'true';
    }
    
    return super.execute(context);
  }
}
```

## Testing Strategy

1. **Command Tests**
   - Test with various endpoints
   - Test with aliases
   - Test parameter validation
   - Test different modes

2. **Safety Tests**
   - Confirmation prompts for non-GET
   - Skip execution mode
   - Timeout handling

3. **Integration Tests**
   - Real API testing (mocked)
   - Authentication validation
   - Error scenarios

## Success Criteria

- [ ] Can test endpoints without caching
- [ ] Validates configuration before testing
- [ ] Provides clear pass/fail status
- [ ] Warns before non-GET requests
- [ ] Shows helpful error messages
- [ ] Supports different test modes

## Common Issues

1. **Timeouts**: Appropriate default timeouts
2. **Authentication**: Testing auth separately
3. **Side Effects**: Clear warnings for mutations
4. **Network Errors**: Clear error messages