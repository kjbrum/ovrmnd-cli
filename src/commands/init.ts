import type { Argv, ArgumentsCamelCase } from 'yargs'
import { BaseCommand } from './base-command'
import { OutputFormatter } from '../utils/output'
import { OvrmndError, ErrorCode } from '../utils/error'
import prompts from 'prompts'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import type { ServiceConfig } from '../types/config'
import { AIConfigGenerator } from '../services/ai-config-generator'

interface InitArgs {
  serviceName?: string
  template: 'rest' | 'graphql'
  output?: string
  force: boolean
  global: boolean
  interactive: boolean
  pretty: boolean
  debug: boolean
  prompt?: string
  apiType?: 'auto' | 'rest' | 'graphql'
}

interface ServiceInfo {
  serviceName: string
  displayName: string
  baseUrl: string
  authType: 'bearer' | 'apikey' | 'none'
  authHeader?: string
  envVarName?: string
}

export class InitCommand extends BaseCommand<InitArgs> {
  command = 'init [serviceName]'
  describe = 'Initialize a new service configuration'

  builder(yargs: Argv): Argv<InitArgs> {
    return yargs
      .positional('serviceName', {
        describe: 'Service name (lowercase, no spaces)',
        type: 'string',
      })
      .option('template', {
        alias: 't',
        describe: 'Template to use',
        type: 'string',
        choices: ['graphql', 'rest'] as const,
        default: 'graphql',
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
        describe: 'Create in global config directory (~/.ovrmnd)',
        type: 'boolean',
        default: false,
      })
      .option('interactive', {
        alias: 'i',
        describe: 'Use interactive mode for configuration',
        type: 'boolean',
        default: false,
      })
      .option('pretty', {
        describe: 'Output in human-readable format',
        type: 'boolean',
        default: false,
      })
      .option('debug', {
        describe: 'Enable debug output',
        type: 'boolean',
        default: false,
      })
      .option('prompt', {
        alias: 'p',
        describe:
          'Natural language prompt for AI-powered config generation. Include API documentation URLs for best results',
        type: 'string',
      })
      .option('api-type', {
        describe:
          'API type preference for AI generation (auto detects best option)',
        type: 'string',
        choices: ['auto', 'rest', 'graphql'] as const,
        default: 'auto',
      })
      .example(
        '$0 init github --interactive',
        'Interactive GitHub GraphQL setup',
      )
      .example('$0 init myapi', 'Create GraphQL API template')
      .example(
        '$0 init shopify --prompt "Shopify GraphQL API for products"',
        'AI-powered config (auto-detects GraphQL)',
      )
      .example(
        '$0 init github --prompt "GitHub API for repos and issues"',
        'AI auto-selects GraphQL when available',
      )
      .example(
        '$0 init myapi --template=rest',
        'Create REST API template (optional)',
      )
      .example(
        '$0 init github --prompt "GitHub REST API" --api-type rest',
        'Force REST API generation',
      )
      .example(
        '$0 init stripe --prompt "Use https://stripe.com/docs/api" --global',
        'AI generation in global directory',
      ) as unknown as Argv<InitArgs>
  }

  handler = async (
    args: ArgumentsCamelCase<InitArgs>,
  ): Promise<void> => {
    const formatter = new OutputFormatter(!args.pretty)

    try {
      let serviceInfo: ServiceInfo
      let template: ServiceConfig

      // Check if AI generation is requested
      if (args.prompt) {
        if (!args.serviceName) {
          throw new OvrmndError({
            code: ErrorCode.PARAM_REQUIRED,
            message: 'Service name is required when using --prompt',
            help: 'Provide service name: ovrmnd init <serviceName> --prompt "..."',
          })
        }

        // Show progress
        if (args.pretty) {
          process.stderr.write(
            formatter.info(
              '🤖 Using AI to research and generate configuration...\n',
            ),
          )
        }

        // Generate config using AI
        const generator = new AIConfigGenerator()
        const options: {
          debug?: boolean
          apiType?: 'auto' | 'rest' | 'graphql'
        } = {
          debug: args.debug,
        }
        if (args.apiType) {
          options.apiType = args.apiType
        }
        template = await generator.generateConfig(
          args.serviceName,
          args.prompt,
          options,
        )

        const authType = template.authentication?.type ?? 'none'
        const extractedEnvVar = template.authentication?.token
          ? this.extractEnvVarName(template.authentication.token)
          : undefined

        serviceInfo = {
          serviceName: template.serviceName,
          displayName: this.toDisplayName(template.serviceName),
          baseUrl: template.baseUrl,
          authType,
          ...(authType === 'apikey' && template.authentication?.header
            ? { authHeader: template.authentication.header }
            : {}),
          ...(extractedEnvVar ? { envVarName: extractedEnvVar } : {}),
        }
      } else {
        // Existing logic for non-AI generation
        serviceInfo = await this.collectServiceInfo(args)
        template = this.generateTemplate(serviceInfo, args.template)
      }

      // Determine output path
      const outputPath = await this.determineOutputPath(
        serviceInfo.serviceName,
        args.output,
        args.global,
      )

      // Check if file exists
      if (!args.force && (await this.fileExists(outputPath))) {
        if (!args.interactive) {
          // Non-interactive mode
          process.stdout.write(
            `${JSON.stringify({
              success: false,
              error: 'File already exists',
              path: outputPath,
              hint: 'Use --force to overwrite',
            })}\n`,
          )
          process.exit(1)
        }

        // Interactive mode
        const { confirm } = (await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `File ${outputPath} already exists. Overwrite?`,
          initial: false,
        })) as { confirm: boolean }

        if (!confirm) {
          process.stderr.write(
            `${formatter.warning('Init cancelled')}\n`,
          )
          return
        }
      }

      // Write configuration file
      await this.writeConfig(outputPath, template)

      // Output success
      if (!args.pretty) {
        // JSON mode
        process.stdout.write(
          `${JSON.stringify({
            success: true,
            path: outputPath,
            service: serviceInfo.serviceName,
            nextSteps: [
              serviceInfo.envVarName
                ? `Set environment variable: ${serviceInfo.envVarName}`
                : null,
              'Update the baseUrl and endpoints as needed',
              `Test with: ovrmnd call ${serviceInfo.serviceName}.<endpoint>`,
              `List endpoints: ovrmnd list endpoints ${serviceInfo.serviceName}`,
            ].filter(Boolean),
          })}\n`,
        )
      } else {
        // Pretty mode
        process.stderr.write(
          `${formatter.success(`Created ${outputPath}`)}\n\n`,
        )
        process.stderr.write(`${formatter.info('Next steps:')}\n`)
        if (serviceInfo.envVarName) {
          process.stderr.write(
            `  1. Set environment variable: ${formatter.highlight(serviceInfo.envVarName)}\n`,
          )
        }
        process.stderr.write(
          `  2. Update the baseUrl and endpoints as needed\n`,
        )
        process.stderr.write(
          `  3. Test with: ${formatter.code(`ovrmnd call ${serviceInfo.serviceName}.<endpoint>`)}\n`,
        )
        process.stderr.write(
          `  4. List endpoints: ${formatter.code(`ovrmnd list endpoints ${serviceInfo.serviceName}`)}\n`,
        )
      }
    } catch (error) {
      const errorOutput = formatter.formatError(error)
      if (formatter.isJsonMode) {
        process.stdout.write(`${errorOutput}\n`)
      } else {
        process.stderr.write(`${errorOutput}\n`)
      }
      process.exit(1)
    }
  }

  private async collectServiceInfo(
    args: ArgumentsCamelCase<InitArgs>,
  ): Promise<ServiceInfo> {
    if (!args.interactive) {
      // Non-interactive mode - require service name
      if (!args.serviceName) {
        throw new OvrmndError({
          code: ErrorCode.PARAM_REQUIRED,
          message: 'Service name required in non-interactive mode',
          help: 'Provide service name as argument or use --interactive for prompts',
        })
      }

      return {
        serviceName: args.serviceName,
        displayName: this.toDisplayName(args.serviceName),
        baseUrl: `https://api.${args.serviceName}.com/v1`,
        authType: 'bearer',
        envVarName: this.toEnvVarName(args.serviceName),
      }
    }

    // Interactive mode
    const questions: prompts.PromptObject[] = []

    if (!args.serviceName) {
      questions.push({
        type: 'text',
        name: 'serviceName',
        message: 'Service name (lowercase, no spaces):',
        validate: (value: string) => {
          if (!value) return 'Service name is required'
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Use only lowercase letters, numbers, and hyphens'
          }
          return true
        },
      })
    }

    questions.push(
      {
        type: 'text',
        name: 'displayName',
        message: 'Display name:',
        initial: (
          _prev: unknown,
          values: { serviceName?: string },
        ) => {
          const name = args.serviceName ?? values.serviceName ?? ''
          return this.toDisplayName(name)
        },
      },
      {
        type: 'text',
        name: 'baseUrl',
        message: 'Base URL:',
        initial: (
          _prev: unknown,
          values: { serviceName?: string },
        ) => {
          const name = args.serviceName ?? values.serviceName ?? ''
          return `https://api.${name}.com/v1`
        },
        validate: (value: string) => {
          try {
            new URL(value)
            return true
          } catch {
            return 'Please enter a valid URL'
          }
        },
      },
      {
        type: 'select',
        name: 'authType',
        message: 'Authentication type:',
        choices: [
          { title: 'Bearer Token', value: 'bearer' },
          { title: 'API Key (Header)', value: 'apikey' },
          { title: 'None', value: 'none' },
        ],
      },
    )

    const answers = (await prompts(questions)) as {
      serviceName?: string
      displayName?: string
      baseUrl?: string
      authType?: 'bearer' | 'apikey' | 'none'
    }

    // User cancelled
    if (!answers.serviceName && !args.serviceName) {
      throw new OvrmndError({
        code: ErrorCode.USER_CANCELLED,
        message: 'Init cancelled by user',
      })
    }

    const serviceName = args.serviceName ?? answers.serviceName ?? ''
    const authType = answers.authType ?? 'bearer'

    // Additional questions based on auth type
    let authHeader: string | undefined
    let envVarName: string | undefined

    if (authType !== 'none') {
      const authQuestions: prompts.PromptObject[] = []

      if (authType === 'apikey') {
        authQuestions.push({
          type: 'text',
          name: 'authHeader',
          message: 'API Key header name:',
          initial: 'X-API-Key',
        })
      }

      authQuestions.push({
        type: 'text',
        name: 'envVarName',
        message: 'Environment variable name:',
        initial: () => this.toEnvVarName(serviceName),
      })

      const authAnswers = (await prompts(authQuestions)) as {
        authHeader?: string
        envVarName?: string
      }
      authHeader = authAnswers.authHeader
      envVarName = authAnswers.envVarName
    }

    return {
      serviceName,
      displayName:
        answers.displayName ?? this.toDisplayName(serviceName),
      baseUrl: answers.baseUrl ?? `https://api.${serviceName}.com/v1`,
      authType,
      ...(authHeader !== undefined && { authHeader }),
      ...(envVarName !== undefined && { envVarName }),
    }
  }

  private generateTemplate(
    info: ServiceInfo,
    templateType: string,
  ): ServiceConfig {
    const template: ServiceConfig = {
      serviceName: info.serviceName,
      baseUrl: info.baseUrl,
    }

    // Add authentication if needed
    if (info.authType !== 'none' && info.envVarName) {
      if (info.authType === 'bearer') {
        template.authentication = {
          type: 'bearer',
          token: `\${${info.envVarName}}`,
        }
      } else if (info.authType === 'apikey') {
        template.authentication = {
          type: 'apikey',
          token: `\${${info.envVarName}}`,
        }
        if (info.authHeader) {
          template.authentication.header = info.authHeader
        }
      }
    }

    // Add template-specific configuration
    if (templateType === 'graphql') {
      template.apiType = 'graphql'
      template.graphqlEndpoint = '/graphql'
      template.graphqlOperations = [
        {
          name: 'listItems',
          operationType: 'query' as const,
          query: `query ListItems($limit: Int, $offset: Int) {
            items(limit: $limit, offset: $offset) {
              id
              name
              description
              createdAt
            }
          }`,
          cacheTTL: 300,
          transform: {
            fields: ['items'],
          },
        },
        {
          name: 'getItem',
          operationType: 'query' as const,
          query: `query GetItem($id: ID!) {
            item(id: $id) {
              id
              name
              description
              createdAt
              updatedAt
            }
          }`,
          cacheTTL: 300,
        },
        {
          name: 'createItem',
          operationType: 'mutation' as const,
          query: `mutation CreateItem($input: CreateItemInput!) {
            createItem(input: $input) {
              id
              name
              description
            }
          }`,
        },
        {
          name: 'updateItem',
          operationType: 'mutation' as const,
          query: `mutation UpdateItem($id: ID!, $input: UpdateItemInput!) {
            updateItem(id: $id, input: $input) {
              id
              name
              description
              updatedAt
            }
          }`,
        },
        {
          name: 'deleteItem',
          operationType: 'mutation' as const,
          query: `mutation DeleteItem($id: ID!) {
            deleteItem(id: $id) {
              success
              message
            }
          }`,
        },
      ]

      // Add example aliases
      template.aliases = [
        {
          name: 'first-item',
          endpoint: 'getItem',
          args: { id: '1' },
        },
      ]
    } else {
      // REST template
      template.endpoints = [
        {
          name: 'list',
          method: 'GET',
          path: '/items',
          cacheTTL: 300,
        },
        {
          name: 'get',
          method: 'GET',
          path: '/items/{id}',
          cacheTTL: 300,
        },
        {
          name: 'create',
          method: 'POST',
          path: '/items',
          defaultParams: {
            name: 'Example Item',
            description: 'Example description',
          },
        },
        {
          name: 'update',
          method: 'PUT',
          path: '/items/{id}',
        },
        {
          name: 'delete',
          method: 'DELETE',
          path: '/items/{id}',
        },
      ]

      // Add example aliases
      template.aliases = [
        {
          name: 'first-item',
          endpoint: 'get',
          args: { id: '1' },
        },
      ]

      // Add example transform
      if (template.endpoints[0]) {
        template.endpoints[0].transform = {
          fields: ['id', 'name', 'created_at'],
        }
      }
    }

    return template
  }

  private async determineOutputPath(
    serviceName: string,
    outputPath?: string,
    global?: boolean,
  ): Promise<string> {
    if (outputPath) {
      return path.resolve(outputPath)
    }

    const filename = `${serviceName}.yaml`

    if (global) {
      const homeDir =
        process.env['HOME'] ?? process.env['USERPROFILE'] ?? ''
      const globalDir = path.join(homeDir, '.ovrmnd')
      await this.ensureDir(globalDir)
      return path.join(globalDir, filename)
    } else {
      const localDir = path.join(process.cwd(), '.ovrmnd')
      await this.ensureDir(localDir)
      return path.join(localDir, filename)
    }
  }

  private async writeConfig(
    filePath: string,
    template: ServiceConfig,
  ): Promise<void> {
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
# Usage: ovrmnd call ${template.serviceName}.<endpoint> [params...]
# Docs: https://github.com/kjbrum/ovrmnd-cli

`

    const yamlContent = yaml.dump(template, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })

    await fs.writeFile(filePath, header + yamlContent, 'utf-8')
    this.logger.info('Configuration file created', { path: filePath })
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.FILE_ERROR,
        message: `Failed to create directory: ${dirPath}`,
        details: error,
      })
    }
  }

  private toDisplayName(serviceName: string): string {
    return serviceName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private toEnvVarName(serviceName: string): string {
    return `${serviceName.toUpperCase().replace(/-/g, '_')}_API_TOKEN`
  }

  private extractEnvVarName(token?: string): string | undefined {
    if (!token) return undefined
    // Extract from ${ENV_VAR_NAME} format
    const match = token.match(/\$\{([^}]+)\}/)
    return match ? match[1] : undefined
  }
}
