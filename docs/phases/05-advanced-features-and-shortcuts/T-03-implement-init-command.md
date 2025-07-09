# Task: Implement Init Command

## Overview

Create the `init` command to generate starter YAML configuration files with common patterns, helping users quickly set up new service integrations.

## Requirements

1. **Template Generation**
   - Interactive prompts for basic info
   - Common authentication patterns
   - Example endpoints
   - Best practices included

2. **Service Templates**
   - REST API template
   - GraphQL template (future)
   - OAuth template (future)
   - Custom template option

3. **File Management**
   - Create in appropriate directory
   - Check for existing files
   - Generate .gitignore entries
   - Set proper permissions

4. **Customization**
   - Service-specific options
   - Authentication method selection
   - Example endpoint types
   - Environment variable names

## Implementation Steps

### 1. Init Command Structure
```typescript
// src/commands/init.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';
import { OutputFormatter } from '@utils/output';
import { createLogger } from '@utils/logger';
import * as prompts from 'prompts';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { ServiceConfig } from '@types';

const logger = createLogger('init-command');

interface InitArgs {
  service?: string;
  template?: 'rest' | 'graphql' | 'oauth' | 'custom';
  output?: string;
  force?: boolean;
  global?: boolean;
  json?: boolean;
}

interface ServiceTemplate {
  serviceName: string;
  baseUrl: string;
  authentication: {
    type: 'bearer' | 'apiKey';
    token?: string;
    header?: string;
    queryParam?: string;
  };
  endpoints: Array<{
    name: string;
    method: string;
    path: string;
    description?: string;
    parameters?: any[];
    cacheTTL?: number;
  }>;
  aliases?: Array<{
    name: string;
    endpoint: string;
    args: Record<string, any>;
    description?: string;
  }>;
}

export class InitCommand extends BaseCommand<InitArgs> {
  command = 'init [service]';
  describe = 'Initialize a new service configuration';
  
  builder(yargs: Argv): Argv<InitArgs> {
    return yargs
      .positional('service', {
        describe: 'Service name (lowercase, no spaces)',
        type: 'string',
      })
      .option('template', {
        alias: 't',
        describe: 'Template to use',
        choices: ['rest', 'graphql', 'oauth', 'custom'] as const,
        default: 'rest',
      })
      .option('output', {
        alias: 'o',
        describe: 'Output file path',
        type: 'string',
      })
      .option('force', {
        alias: 'f',
        describe: 'Overwrite existing file',
        type: 'boolean',
        default: false,
      })
      .option('global', {
        alias: 'g',
        describe: 'Create in global config directory',
        type: 'boolean',
        default: false,
      })
      .example('$0 init github', 'Interactive GitHub service setup')
      .example('$0 init myapi --template=rest', 'Create REST API template')
      .example('$0 init slack --global', 'Create in global directory');
  }
  
  async handler(args: Arguments<InitArgs>): Promise<void> {
    try {
      const formatter = new OutputFormatter(args.json);
      
      // Collect service information
      const serviceInfo = await this.collectServiceInfo(args);
      
      // Generate template
      const template = await this.generateTemplate(serviceInfo, args.template || 'rest');
      
      // Determine output path
      const outputPath = await this.determineOutputPath(
        serviceInfo.serviceName,
        args.output,
        args.global || false
      );
      
      // Check if file exists
      if (!args.force && await this.fileExists(outputPath)) {
        if (args.json) {
          console.log(formatter.format({
            success: false,
            error: 'File already exists',
            path: outputPath,
          }));
          return;
        }
        
        const overwrite = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `File ${outputPath} already exists. Overwrite?`,
          initial: false,
        });
        
        if (!overwrite.confirm) {
          console.log(formatter.info('Init cancelled'));
          return;
        }
      }
      
      // Write configuration file
      await this.writeConfig(outputPath, template);
      
      // Update .gitignore if needed
      await this.updateGitignore(path.dirname(outputPath));
      
      // Create .env.example if needed
      await this.createEnvExample(serviceInfo, path.dirname(outputPath));
      
      // Output success message
      if (args.json) {
        console.log(formatter.format({
          success: true,
          path: outputPath,
          service: serviceInfo.serviceName,
        }));
      } else {
        console.log(chalk.green(`\n✓ Created ${outputPath}`));
        console.log('\nNext steps:');
        console.log(`  1. Set environment variable: ${serviceInfo.envVarName}`);
        console.log(`  2. Update the baseUrl and endpoints as needed`);
        console.log(`  3. Test with: ovrmnd test ${serviceInfo.serviceName}.example`);
        console.log(`  4. List endpoints: ovrmnd list endpoints ${serviceInfo.serviceName}`);
      }
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private async collectServiceInfo(args: InitArgs): Promise<any> {
    if (args.json) {
      // In JSON mode, require all info via args
      if (!args.service) {
        throw new Error('Service name required in JSON mode');
      }
      return {
        serviceName: args.service,
        displayName: args.service,
        baseUrl: `https://api.${args.service}.com`,
        authType: 'bearer',
        envVarName: `${args.service.toUpperCase()}_API_TOKEN`,
      };
    }
    
    // Interactive mode
    const questions = [
      {
        type: args.service ? null : 'text',
        name: 'serviceName',
        message: 'Service name (lowercase, no spaces):',
        initial: args.service,
        validate: (value: string) => {
          if (!value) return 'Service name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Use only lowercase letters, numbers, and hyphens';
          }
          return true;
        },
      },
      {
        type: 'text',
        name: 'displayName',
        message: 'Display name:',
        initial: (prev: string) => {
          return prev.charAt(0).toUpperCase() + prev.slice(1);
        },
      },
      {
        type: 'text',
        name: 'baseUrl',
        message: 'Base URL:',
        initial: (prev: string, values: any) => {
          return `https://api.${values.serviceName}.com`;
        },
        validate: (value: string) => {
          try {
            new URL(value);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
      {
        type: 'select',
        name: 'authType',
        message: 'Authentication type:',
        choices: [
          { title: 'Bearer Token', value: 'bearer' },
          { title: 'API Key (Header)', value: 'apiKey' },
          { title: 'API Key (Query)', value: 'apiKeyQuery' },
          { title: 'None', value: 'none' },
        ],
      },
      {
        type: (prev: string) => prev !== 'none' ? 'text' : null,
        name: 'envVarName',
        message: 'Environment variable name:',
        initial: (prev: string, values: any) => {
          return `${values.serviceName.toUpperCase().replace(/-/g, '_')}_API_TOKEN`;
        },
      },
    ].filter(q => q.type !== null);
    
    const answers = await prompts(questions);
    
    if (!answers.serviceName) {
      throw new Error('Service name is required');
    }
    
    return {
      ...args,
      serviceName: args.service || answers.serviceName,
      ...answers,
    };
  }
  
  private async generateTemplate(
    info: any,
    templateType: string
  ): Promise<ServiceTemplate> {
    const template: ServiceTemplate = {
      serviceName: info.serviceName,
      baseUrl: info.baseUrl,
      authentication: this.buildAuthentication(info),
      endpoints: [],
      aliases: [],
    };
    
    // Add template-specific endpoints
    switch (templateType) {
      case 'rest':
        template.endpoints = [
          {
            name: 'list-items',
            method: 'GET',
            path: '/items',
            description: 'List all items',
            cacheTTL: 300,
          },
          {
            name: 'get-item',
            method: 'GET',
            path: '/items/{id}',
            description: 'Get a specific item by ID',
            cacheTTL: 300,
          },
          {
            name: 'create-item',
            method: 'POST',
            path: '/items',
            description: 'Create a new item',
            parameters: [
              {
                name: 'name',
                type: 'body',
                required: true,
              },
              {
                name: 'description',
                type: 'body',
                required: false,
              },
            ],
          },
          {
            name: 'update-item',
            method: 'PUT',
            path: '/items/{id}',
            description: 'Update an existing item',
            parameters: [
              {
                name: 'name',
                type: 'body',
                required: false,
              },
              {
                name: 'description',
                type: 'body',
                required: false,
              },
            ],
          },
          {
            name: 'delete-item',
            method: 'DELETE',
            path: '/items/{id}',
            description: 'Delete an item',
          },
        ];
        
        template.aliases = [
          {
            name: 'example',
            endpoint: 'list-items',
            args: {},
            description: 'Example alias - lists all items',
          },
        ];
        break;
        
      // Add more template types in the future
      default:
        template.endpoints = [
          {
            name: 'example',
            method: 'GET',
            path: '/example',
            description: 'Example endpoint',
          },
        ];
    }
    
    return template;
  }
  
  private buildAuthentication(info: any): ServiceTemplate['authentication'] {
    switch (info.authType) {
      case 'bearer':
        return {
          type: 'bearer',
          token: `\${${info.envVarName}}`,
        };
      
      case 'apiKey':
        return {
          type: 'apiKey',
          header: 'X-API-Key',
          token: `\${${info.envVarName}}`,
        };
      
      case 'apiKeyQuery':
        return {
          type: 'apiKey',
          queryParam: 'api_key',
          token: `\${${info.envVarName}}`,
        };
      
      case 'none':
      default:
        return {
          type: 'bearer',
          token: '',
        };
    }
  }
  
  private async determineOutputPath(
    serviceName: string,
    outputPath?: string,
    global?: boolean
  ): Promise<string> {
    if (outputPath) {
      return path.resolve(outputPath);
    }
    
    const filename = `${serviceName}.yaml`;
    
    if (global) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const globalDir = path.join(homeDir, '.ovrmnd');
      await this.ensureDir(globalDir);
      return path.join(globalDir, filename);
    } else {
      const localDir = path.join(process.cwd(), '.ovrmnd');
      await this.ensureDir(localDir);
      return path.join(localDir, filename);
    }
  }
  
  private async writeConfig(filePath: string, template: ServiceTemplate): Promise<void> {
    // Add header comment
    const header = `# ${template.serviceName} API Configuration
# Generated by ovrmnd init
# 
# Before using this configuration:
# 1. Set the required environment variables
# 2. Update the baseUrl if needed
# 3. Modify endpoints to match your API
# 4. Add any additional endpoints or aliases
#
# Documentation: https://github.com/ovrmnd/cli

`;
    
    const yamlContent = yaml.dump(template, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
    
    await fs.writeFile(filePath, header + yamlContent, 'utf-8');
    logger.info('Configuration file created', { path: filePath });
  }
  
  private async updateGitignore(directory: string): Promise<void> {
    const gitignorePath = path.join(directory, '.gitignore');
    const entries = ['.env', '.env.local', '*.log'];
    
    try {
      let content = '';
      
      if (await this.fileExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf-8');
      }
      
      const lines = content.split('\n');
      let updated = false;
      
      for (const entry of entries) {
        if (!lines.includes(entry)) {
          lines.push(entry);
          updated = true;
        }
      }
      
      if (updated) {
        await fs.writeFile(gitignorePath, lines.join('\n'), 'utf-8');
        logger.info('Updated .gitignore', { path: gitignorePath });
      }
    } catch (error) {
      logger.warn('Could not update .gitignore', error);
    }
  }
  
  private async createEnvExample(info: any, directory: string): Promise<void> {
    if (!info.envVarName || info.authType === 'none') {
      return;
    }
    
    const envExamplePath = path.join(directory, '.env.example');
    
    try {
      let content = '';
      
      if (await this.fileExists(envExamplePath)) {
        content = await fs.readFile(envExamplePath, 'utf-8');
      }
      
      const entry = `${info.envVarName}=your_${info.serviceName}_token_here`;
      
      if (!content.includes(info.envVarName)) {
        content += (content ? '\n' : '') + entry + '\n';
        await fs.writeFile(envExamplePath, content, 'utf-8');
        logger.info('Updated .env.example', { path: envExamplePath });
      }
    } catch (error) {
      logger.warn('Could not create .env.example', error);
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${dirPath}`);
    }
  }
}
```

### 2. Template Examples

```yaml
# REST API Template
serviceName: myapi
baseUrl: https://api.myapi.com/v1
authentication:
  type: bearer
  token: ${MYAPI_TOKEN}

endpoints:
  - name: list-items
    method: GET
    path: /items
    description: List all items
    cacheTTL: 300
    
  - name: get-item
    method: GET
    path: /items/{id}
    description: Get a specific item by ID
    cacheTTL: 300
    
  - name: create-item
    method: POST
    path: /items
    description: Create a new item
    parameters:
      - name: name
        type: body
        required: true
      - name: description
        type: body
        required: false

aliases:
  - name: example
    endpoint: list-items
    args: {}
    description: Example alias - lists all items
```

## Testing Strategy

1. **Interactive Tests**
   - Test prompts flow
   - Validation of inputs
   - Different template types

2. **File Operations**
   - File creation
   - Overwrite protection
   - Directory creation

3. **Template Tests**
   - Valid YAML generation
   - Different auth types
   - Template variations

## Success Criteria

- [ ] Interactive prompts collect all needed info
- [ ] Generates valid YAML configuration
- [ ] Creates appropriate directory structure
- [ ] Updates .gitignore with security entries
- [ ] Provides helpful next steps
- [ ] Templates follow best practices

## Common Issues

1. **File Permissions**: Handle permission errors
2. **Existing Files**: Clear overwrite behavior
3. **Template Quality**: Useful, working examples
4. **Path Resolution**: Cross-platform paths

