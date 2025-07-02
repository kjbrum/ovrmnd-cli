# Task: Implement List Command

## Overview

Create the `list` command to help users discover available services, endpoints, and aliases. This command is crucial for discoverability and developer experience.

## Requirements

1. **List Services**
   - Show all configured services
   - Display service names and base URLs
   - Indicate authentication type
   - Show count of endpoints

2. **List Endpoints**
   - Show all endpoints for a service
   - Display required/optional parameters
   - Show HTTP method and path
   - Include cache TTL if configured

3. **List Aliases**
   - Show all aliases for a service
   - Display preconfigured arguments
   - Show which endpoint they reference
   - Include descriptions if available

4. **Output Formatting**
   - Human-readable table format by default
   - JSON output with --json flag
   - Consistent formatting across subcommands

## Implementation Steps

### 1. Command Structure
```typescript
// src/commands/list.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';
import { ConfigDiscovery } from '@config/discovery';
import { ServiceRegistry } from '@config/registry';
import { OutputFormatter } from '@utils/output';
import { createLogger } from '@utils/logger';

const logger = createLogger('list-command');

interface ListArgs {
  type: 'services' | 'endpoints' | 'aliases';
  service?: string;
  json?: boolean;
  verbose?: boolean;
}

export class ListCommand extends BaseCommand<ListArgs> {
  command = 'list <type> [service]';
  describe = 'List available services, endpoints, or aliases';
  
  builder(yargs: Argv): Argv<ListArgs> {
    return yargs
      .positional('type', {
        describe: 'What to list',
        type: 'string',
        choices: ['services', 'endpoints', 'aliases'],
        demandOption: true,
      })
      .positional('service', {
        describe: 'Service name (required for endpoints/aliases)',
        type: 'string',
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show additional details',
        type: 'boolean',
        default: false,
      })
      .check((argv) => {
        if (['endpoints', 'aliases'].includes(argv.type) && !argv.service) {
          throw new Error(`Service name required when listing ${argv.type}`);
        }
        return true;
      })
      .example('$0 list services', 'List all available services')
      .example('$0 list endpoints github', 'List GitHub endpoints')
      .example('$0 list aliases slack', 'List Slack aliases');
  }
  
  async handler(args: Arguments<ListArgs>): Promise<void> {
    try {
      const formatter = new OutputFormatter(args.json);
      const registry = await ServiceRegistry.load();
      
      switch (args.type) {
        case 'services':
          await this.listServices(registry, formatter, args.verbose);
          break;
        case 'endpoints':
          await this.listEndpoints(registry, args.service!, formatter, args.verbose);
          break;
        case 'aliases':
          await this.listAliases(registry, args.service!, formatter, args.verbose);
          break;
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private async listServices(
    registry: ServiceRegistry,
    formatter: OutputFormatter,
    verbose: boolean
  ): Promise<void> {
    const services = registry.getAllServices();
    
    if (services.length === 0) {
      console.log(formatter.info('No services configured'));
      return;
    }
    
    const serviceData = services.map(service => ({
      name: service.serviceName,
      baseUrl: service.baseUrl,
      auth: service.authentication.type,
      endpoints: service.endpoints.length,
      aliases: service.aliases?.length || 0,
    }));
    
    if (formatter.isJson()) {
      console.log(formatter.format({ services: serviceData }));
    } else {
      console.log(formatter.table(serviceData, {
        columns: ['name', 'baseUrl', 'auth', 'endpoints', 'aliases'],
        headers: {
          name: 'Service',
          baseUrl: 'Base URL',
          auth: 'Auth Type',
          endpoints: 'Endpoints',
          aliases: 'Aliases',
        },
      }));
      
      if (verbose) {
        console.log(`\nTotal services: ${services.length}`);
        console.log('Use "ovrmnd list endpoints <service>" for more details');
      }
    }
  }
  
  private async listEndpoints(
    registry: ServiceRegistry,
    serviceName: string,
    formatter: OutputFormatter,
    verbose: boolean
  ): Promise<void> {
    const service = registry.getService(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }
    
    const endpointData = service.endpoints.map(endpoint => {
      const pathParams = this.extractPathParams(endpoint.path);
      const otherParams = endpoint.parameters?.filter(p => p.type !== 'path') || [];
      
      return {
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        requiredParams: [...pathParams, ...otherParams.filter(p => p.required)].map(p => p.name),
        optionalParams: otherParams.filter(p => !p.required).map(p => p.name),
        cacheTTL: endpoint.cacheTTL,
        hasTransform: !!endpoint.transform,
      };
    });
    
    if (formatter.isJson()) {
      console.log(formatter.format({
        service: serviceName,
        endpoints: endpointData,
      }));
    } else {
      console.log(`\nEndpoints for ${serviceName}:\n`);
      
      endpointData.forEach(endpoint => {
        console.log(`  ${endpoint.name}`);
        console.log(`    Method: ${endpoint.method} ${endpoint.path}`);
        
        if (endpoint.requiredParams.length > 0) {
          console.log(`    Required: ${endpoint.requiredParams.join(', ')}`);
        }
        
        if (endpoint.optionalParams.length > 0) {
          console.log(`    Optional: ${endpoint.optionalParams.join(', ')}`);
        }
        
        if (verbose) {
          if (endpoint.cacheTTL) {
            console.log(`    Cache TTL: ${endpoint.cacheTTL}s`);
          }
          if (endpoint.hasTransform) {
            console.log(`    Transform: yes`);
          }
        }
        
        console.log();
      });
      
      console.log(`Total endpoints: ${endpointData.length}`);
    }
  }
  
  private async listAliases(
    registry: ServiceRegistry,
    serviceName: string,
    formatter: OutputFormatter,
    verbose: boolean
  ): Promise<void> {
    const service = registry.getService(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }
    
    const aliases = service.aliases || [];
    if (aliases.length === 0) {
      console.log(formatter.info(`No aliases configured for ${serviceName}`));
      return;
    }
    
    const aliasData = aliases.map(alias => ({
      name: alias.name,
      endpoint: alias.endpoint,
      args: alias.args,
      description: alias.description,
    }));
    
    if (formatter.isJson()) {
      console.log(formatter.format({
        service: serviceName,
        aliases: aliasData,
      }));
    } else {
      console.log(`\nAliases for ${serviceName}:\n`);
      
      aliasData.forEach(alias => {
        console.log(`  ${alias.name} -> ${alias.endpoint}`);
        
        if (alias.description) {
          console.log(`    ${alias.description}`);
        }
        
        if (verbose && Object.keys(alias.args).length > 0) {
          console.log(`    Args: ${JSON.stringify(alias.args, null, 2).split('\n').join('\n    ')}`);
        }
        
        console.log();
      });
      
      console.log(`Total aliases: ${aliasData.length}`);
    }
  }
  
  private extractPathParams(path: string): Array<{ name: string }> {
    const params: string[] = [];
    const regex = /{([^}]+)}/g;
    let match;
    
    while ((match = regex.exec(path)) !== null) {
      params.push(match[1]);
    }
    
    return params.map(name => ({ name }));
  }
}
```

### 2. Output Formatter
```typescript
// src/utils/output.ts
import Table from 'cli-table3';
import chalk from 'chalk';

export class OutputFormatter {
  private jsonMode: boolean;
  
  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
  }
  
  isJson(): boolean {
    return this.jsonMode;
  }
  
  format<T>(data: T): string {
    if (this.jsonMode) {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  }
  
  info(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ info: message });
    }
    return chalk.blue(`ℹ ${message}`);
  }
  
  error(error: Error | any): string {
    if (this.jsonMode) {
      return JSON.stringify({
        success: false,
        error: {
          message: error.message || String(error),
          ...(error.code && { code: error.code }),
        },
      });
    }
    return chalk.red(`✖ Error: ${error.message || error}`);
  }
  
  table(data: any[], options: TableOptions): string {
    if (this.jsonMode) {
      return this.format(data);
    }
    
    const table = new Table({
      head: options.columns.map(col => options.headers?.[col] || col),
      style: { head: ['cyan'] },
    });
    
    data.forEach(row => {
      table.push(options.columns.map(col => row[col] || ''));
    });
    
    return table.toString();
  }
}

interface TableOptions {
  columns: string[];
  headers?: Record<string, string>;
}
```

### 3. Service Registry Enhancement
```typescript
// src/config/registry.ts
export class ServiceRegistry {
  private services: Map<string, ServiceConfig>;
  
  static async load(): Promise<ServiceRegistry> {
    const discovery = new ConfigDiscovery();
    const configs = await discovery.discoverAndLoad();
    return new ServiceRegistry(configs);
  }
  
  constructor(services: Map<string, ServiceConfig>) {
    this.services = services;
  }
  
  getAllServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }
  
  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }
  
  hasService(name: string): boolean {
    return this.services.has(name);
  }
}
```

## Testing Strategy

1. **Unit Tests**
   - Test each list subcommand
   - Test output formatting
   - Test error handling

2. **Integration Tests**
   - Test with real YAML configs
   - Test JSON output mode
   - Test verbose mode

3. **Test Cases**
   - Empty service list
   - Service with no aliases
   - Invalid service name
   - Mixed parameter types

## Success Criteria

- [ ] Can list all services with basic info
- [ ] Can list endpoints with parameters
- [ ] Can list aliases with configurations
- [ ] JSON output mode works correctly
- [ ] Error messages are helpful
- [ ] Table formatting is clean and readable

## Dependencies

```bash
npm install cli-table3
npm install --save-dev @types/cli-table3
```

## Common Issues

1. **Table Width**: Handle long URLs and paths
2. **JSON Formatting**: Ensure valid JSON in all cases
3. **Empty Lists**: Provide helpful messages
4. **Parameter Display**: Show path params clearly