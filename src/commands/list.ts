import type { Argv, ArgumentsCamelCase } from 'yargs'
import { BaseCommand } from './base-command'
import { ConfigDiscovery } from '../config'
import { OutputFormatter } from '../utils/output'
import { OvrmndError, ErrorCode } from '../utils/error'
import { DebugFormatter } from '../utils/debug'
import type { ServiceConfig } from '../types/config'

interface ListArgs {
  resource: string
  service?: string
  pretty: boolean
  debug: boolean
  config?: string
}

type ListResource = 'services' | 'endpoints' | 'aliases'

export class ListCommand extends BaseCommand<ListArgs> {
  command = 'list <resource> [service]'
  describe = 'List available services, endpoints, or aliases'

  builder(yargs: Argv): Argv<ListArgs> {
    return yargs
      .positional('resource', {
        describe: 'What to list',
        type: 'string',
        choices: ['services', 'endpoints', 'aliases'],
        demandOption: true,
      })
      .positional('service', {
        describe: 'Service name (required for endpoints/aliases)',
        type: 'string',
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
      .option('config', {
        describe: 'Path to config directory',
        type: 'string',
      })
      .check(argv => {
        const resource = argv.resource as ListResource
        if (
          (resource === 'endpoints' || resource === 'aliases') &&
          !argv.service
        ) {
          throw new Error(
            `Service name is required when listing ${resource}`,
          )
        }
        return true
      }) as unknown as Argv<ListArgs>
  }

  handler = async (
    args: ArgumentsCamelCase<ListArgs>,
  ): Promise<void> => {
    const formatter = new OutputFormatter(!args.pretty)
    const debugFormatter = new DebugFormatter(args.debug)

    try {
      // Validate required args
      if (!args.resource) {
        throw new OvrmndError({
          code: ErrorCode.PARAM_REQUIRED,
          message: 'Resource is required',
        })
      }

      const configDir = args.config
      const discovery = new ConfigDiscovery()

      // Debug config loading
      if (debugFormatter.isEnabled) {
        debugFormatter.debug('CONFIG', 'Loading configurations', {
          configDir: configDir ?? 'default (~/.ovrmnd and ./.ovrmnd)',
        })
      }

      const configs = await discovery.loadAll(configDir)

      const resource = args.resource as ListResource

      switch (resource) {
        case 'services':
          this.listServices(configs, formatter)
          break
        case 'endpoints':
          this.listEndpoints(configs, args.service!, formatter)
          break
        case 'aliases':
          this.listAliases(configs, args.service!, formatter)
          break
      }
    } catch (error) {
      const errorOutput = formatter.formatError(error)
      process.stderr.write(`${errorOutput}\n`)
      process.exit(1)
    }
  }

  private listServices(
    configs: Map<string, ServiceConfig>,
    formatter: OutputFormatter,
  ): void {
    if (configs.size === 0) {
      if (formatter.isJsonMode) {
        process.stdout.write(`${JSON.stringify({ services: [] })}\n`)
      } else {
        process.stderr.write(
          `${formatter.warning('No services configured')}\n`,
        )
        process.stderr.write(
          '\nTo add a service, create a YAML file in:\n',
        )
        process.stderr.write('  ~/.ovrmnd/   (global)\n')
        process.stderr.write('  ./.ovrmnd/   (project-specific)\n')
      }
      return
    }

    const services = Array.from(configs.entries()).map(
      ([name, config]) => ({
        name,
        baseUrl: config.baseUrl,
        authentication: config.authentication?.type ?? 'none',
        endpoints: config.endpoints.length,
        aliases: config.aliases?.length ?? 0,
      }),
    )

    if (formatter.isJsonMode) {
      process.stdout.write(`${JSON.stringify({ services })}\n`)
    } else {
      process.stderr.write(
        `${formatter.success(`Found ${services.length} configured service(s)\n`)}\n`,
      )

      const headers = [
        'Service',
        'Base URL',
        'Auth',
        'Endpoints',
        'Aliases',
      ]
      const rows = services.map(s => [
        s.name,
        s.baseUrl,
        s.authentication,
        s.endpoints.toString(),
        s.aliases.toString(),
      ])

      process.stderr.write(`${formatter.table(headers, rows)}\n`)
    }
  }

  private listEndpoints(
    configs: Map<string, ServiceConfig>,
    serviceName: string,
    formatter: OutputFormatter,
  ): void {
    const config = configs.get(serviceName)
    if (!config) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Service '${serviceName}' not found`,
        help: 'Use "ovrmnd list services" to see available services',
      })
    }

    const endpoints = config.endpoints.map(endpoint => ({
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      cacheTTL: endpoint.cacheTTL,
      parameters: this.extractParameters(endpoint.path),
    }))

    if (formatter.isJsonMode) {
      process.stdout.write(
        `${JSON.stringify({ service: serviceName, endpoints })}\n`,
      )
    } else {
      process.stderr.write(
        `${formatter.success(`Endpoints for service '${serviceName}':\n`)}\n`,
      )

      if (endpoints.length === 0) {
        process.stderr.write(
          `${formatter.warning('No endpoints configured')}\n`,
        )
        return
      }

      const headers = [
        'Endpoint',
        'Method',
        'Path',
        'Cache TTL',
        'Parameters',
      ]
      const rows = endpoints.map(e => [
        e.name,
        e.method,
        e.path,
        e.cacheTTL ? `${e.cacheTTL}s` : '-',
        e.parameters.length > 0 ? e.parameters.join(', ') : '-',
      ])

      process.stderr.write(`${formatter.table(headers, rows)}\n`)
      process.stderr.write(
        `\nUsage: ovrmnd call ${serviceName}.<endpoint> [params...]\n`,
      )
    }
  }

  private listAliases(
    configs: Map<string, ServiceConfig>,
    serviceName: string,
    formatter: OutputFormatter,
  ): void {
    const config = configs.get(serviceName)
    if (!config) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Service '${serviceName}' not found`,
        help: 'Use "ovrmnd list services" to see available services',
      })
    }

    const aliases = (config.aliases ?? []).map(alias => ({
      name: alias.name,
      endpoint: alias.endpoint,
      description: this.generateAliasDescription(alias.args),
      args: alias.args,
    }))

    if (formatter.isJsonMode) {
      process.stdout.write(
        `${JSON.stringify({ service: serviceName, aliases })}\n`,
      )
    } else {
      process.stderr.write(
        `${formatter.success(`Aliases for service '${serviceName}':\n`)}\n`,
      )

      if (aliases.length === 0) {
        process.stderr.write(
          `${formatter.warning('No aliases configured')}\n`,
        )
        return
      }

      const headers = [
        'Alias',
        'Endpoint',
        'Pre-configured Arguments',
      ]
      const rows = aliases.map(a => [
        a.name,
        a.endpoint,
        a.description,
      ])

      process.stderr.write(`${formatter.table(headers, rows)}\n`)
      process.stderr.write(
        `\nUsage: ovrmnd call ${serviceName}.<alias> [additional params...]\n`,
      )
    }
  }

  private extractParameters(path: string | undefined): string[] {
    if (!path) return []

    const paramRegex = /\{([^}]+)\}/g
    const params: string[] = []
    let match

    while ((match = paramRegex.exec(path)) !== null) {
      if (match[1]) {
        params.push(match[1])
      }
    }

    return params
  }

  private generateAliasDescription(
    args: Record<string, unknown> | undefined,
  ): string {
    if (!args || Object.keys(args).length === 0) {
      return 'None'
    }

    const entries = Object.entries(args)
    if (entries.length > 3) {
      const shown = entries
        .slice(0, 3)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')
      return `${shown}, ... (${entries.length - 3} more)`
    }

    return entries
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ')
  }
}
