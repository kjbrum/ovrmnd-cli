import type { Argv, ArgumentsCamelCase } from 'yargs'
import { BaseCommand } from './base-command'
import { loadServiceConfig } from '../config'
import { callEndpoint } from '../api/client'
import { mapParameters } from '../api/params'
import { OutputFormatter } from '../utils/output'
import { OvrmndError, ErrorCode } from '../utils/error'
import type { EndpointConfig } from '../types/config'
import type { ParamHints, RawParams } from '../api/params'

interface CallCommandArgs {
  target: string
  pretty?: boolean
  debug?: boolean
  config?: string
  _: (string | number)[]
  [key: string]: unknown
}

export class CallCommand extends BaseCommand<CallCommandArgs> {
  command = 'call <target> [params...]'
  describe = 'Call an API endpoint'

  builder(yargs: Argv): Argv<CallCommandArgs> {
    return yargs
      .positional('target', {
        describe: 'Service.endpoint or service.alias',
        type: 'string',
        demandOption: true,
      })
      .positional('params', {
        describe: 'Parameters in key=value format',
        type: 'string',
        array: true,
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
      .option('path', {
        describe: 'Path parameters (key=value)',
        type: 'array',
        default: [],
      })
      .option('query', {
        describe: 'Query parameters (key=value)',
        type: 'array',
        default: [],
      })
      .option('header', {
        describe: 'Header parameters (key=value)',
        type: 'array',
        default: [],
      })
      .option('body', {
        describe: 'Body parameters (key=value)',
        type: 'array',
        default: [],
      })
      .example('$0 call github.listRepos', 'List GitHub repositories')
      .example(
        '$0 call github.getRepo owner=octocat repo=hello-world',
        'Get a specific repository',
      )
      .example(
        '$0 call api.users --query limit=10 --pretty',
        'Get users with query parameter in human-readable format',
      ) as Argv<CallCommandArgs>
  }

  handler = async (
    args: ArgumentsCamelCase<CallCommandArgs>,
  ): Promise<void> => {
    const formatter = new OutputFormatter(!args.pretty)

    try {
      // Parse target into service and endpoint
      const [service, endpointOrAlias] = args.target.split('.')
      if (!service || !endpointOrAlias) {
        throw new OvrmndError({
          code: ErrorCode.PARAM_INVALID,
          message: `Invalid target format '${args.target}'. Use format: service.endpoint or service.alias`,
          help: 'Example: ovrmnd call github.listRepos',
        })
      }

      // Load configuration
      const config = await loadServiceConfig(service)

      // Find endpoint or alias
      let endpoint: EndpointConfig | undefined
      let aliasParams: Record<string, unknown> = {}

      // First check if it's an alias
      const alias = config.aliases?.find(
        a => a.name === endpointOrAlias,
      )
      if (alias) {
        endpoint = config.endpoints.find(
          e => e.name === alias.endpoint,
        )
        if (!endpoint) {
          throw new OvrmndError({
            code: ErrorCode.ENDPOINT_NOT_FOUND,
            message: `Endpoint '${alias.endpoint}' referenced by alias '${endpointOrAlias}' not found`,
          })
        }
        aliasParams = alias.args ?? {}
      } else {
        // Look for direct endpoint
        endpoint = config.endpoints.find(
          e => e.name === endpointOrAlias,
        )
      }

      if (!endpoint) {
        throw new OvrmndError({
          code: ErrorCode.ENDPOINT_NOT_FOUND,
          message: `Endpoint or alias '${endpointOrAlias}' not found in service '${service}'`,
          help: `Run 'ovrmnd list ${service}' to see available endpoints and aliases`,
        })
      }

      // Parse raw parameters
      const rawParams: RawParams = {}

      // Add positional parameters
      const positionalParams = args['params'] || []
      if (Array.isArray(positionalParams)) {
        for (const param of positionalParams) {
          if (typeof param === 'string') {
            const [key, ...valueParts] = param.split('=')
            if (key && valueParts.length > 0) {
              rawParams[key] = valueParts.join('=')
            }
          }
        }
      }

      // Add explicitly typed parameters
      const pathParams = this.parseKeyValueArray(
        args['path'] as string[],
      )
      const queryParams = this.parseKeyValueArray(
        args['query'] as string[],
      )
      const headerParams = this.parseKeyValueArray(
        args['header'] as string[],
      )
      const bodyParams = this.parseKeyValueArray(
        args['body'] as string[],
      )

      // Merge with rawParams (typed params override positional)
      Object.assign(
        rawParams,
        pathParams,
        queryParams,
        headerParams,
        bodyParams,
      )

      // Create parameter hints from options
      const hints: ParamHints = {
        pathParams: Object.keys(pathParams),
        queryParams: Object.keys(queryParams),
        headerParams: Object.keys(headerParams),
        bodyParams: Object.keys(bodyParams),
      }

      // Merge alias parameters with raw parameters (raw params override alias)
      const mergedParams: RawParams = {}

      // First add alias params (converted to appropriate types)
      for (const [key, value] of Object.entries(aliasParams)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          Array.isArray(value)
        ) {
          mergedParams[key] = value
        } else if (value !== null && value !== undefined) {
          mergedParams[key] = String(value)
        }
      }

      // Then override with raw params
      Object.assign(mergedParams, rawParams)

      // Map parameters
      const mappedParams = mapParameters(
        endpoint,
        mergedParams,
        hints,
      )

      if (args.debug) {
        this.logger.debug('Calling endpoint', {
          service,
          endpoint: endpoint.name,
          alias: alias?.name,
          mappedParams,
        })
      }

      // Make the API call
      const response = await callEndpoint(
        config,
        endpoint,
        mappedParams,
      )

      // Output the response
      const output = formatter.formatApiResponse(response)
      process.stdout.write(`${output}\n`)

      if (!response.success) {
        process.exit(1)
      }
    } catch (error) {
      // Use the same formatter for errors to ensure consistency
      const errorOutput = formatter.formatError(error)
      console.error(errorOutput)
      process.exit(1)
    }
  }

  private parseKeyValueArray(arr: string[]): Record<string, string> {
    const result: Record<string, string> = {}

    for (const item of arr) {
      const [key, ...valueParts] = item.split('=')
      if (key && valueParts.length > 0) {
        result[key] = valueParts.join('=')
      }
    }

    return result
  }
}
