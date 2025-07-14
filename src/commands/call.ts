import type { Argv, ArgumentsCamelCase } from 'yargs'
import { BaseCommand } from './base-command'
import { loadServiceConfig } from '../config'
import { callEndpoint } from '../api/client'
import { executeGraphQLOperation } from '../api/graphql'
import { mapParameters } from '../api/params'
import { OutputFormatter } from '../utils/output'
import { OvrmndError, ErrorCode } from '../utils/error'
import { DebugFormatter } from '../utils/debug'
import type { ServiceConfig, EndpointConfig } from '../types/config'
import type { GraphQLOperationConfig } from '../types/graphql'
import type { ParamHints, RawParams } from '../api/params'
import type { ApiResponse } from '../types'
import { CacheStorage } from '../cache'

interface CallCommandArgs {
  target: string
  pretty?: boolean
  debug?: boolean
  config?: string
  batchJson?: string
  failFast?: boolean
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
      .option('batch-json', {
        describe: 'JSON array of parameter sets for batch operations',
        type: 'string',
      })
      .option('fail-fast', {
        describe: 'Stop on first error in batch operations',
        type: 'boolean',
        default: false,
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
      )
      .example(
        '$0 call api.getUser --batch-json=\'[{"id": "1"}, {"id": "2"}]\'',
        'Batch get multiple users',
      ) as Argv<CallCommandArgs>
  }

  handler = async (
    args: ArgumentsCamelCase<CallCommandArgs>,
  ): Promise<void> => {
    const formatter = new OutputFormatter(!args.pretty)
    const debugFormatter = new DebugFormatter(args.debug ?? false)

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
      const config = await loadServiceConfig(service, debugFormatter)

      // Check if this is a GraphQL service
      const isGraphQL =
        !config.apiType || config.apiType === 'graphql'

      // Find endpoint/operation or alias
      let endpoint: EndpointConfig | undefined
      let operation: GraphQLOperationConfig | undefined
      let aliasParams: Record<string, unknown> = {}

      // First check if it's an alias
      const alias = config.aliases?.find(
        a => a.name === endpointOrAlias,
      )
      if (alias) {
        if (isGraphQL) {
          operation = config.graphqlOperations?.find(
            op => op.name === alias.endpoint,
          )
          if (!operation) {
            throw new OvrmndError({
              code: ErrorCode.ENDPOINT_NOT_FOUND,
              message: `GraphQL operation '${alias.endpoint}' referenced by alias '${endpointOrAlias}' not found`,
            })
          }
        } else {
          endpoint = config.endpoints?.find(
            e => e.name === alias.endpoint,
          )
          if (!endpoint) {
            throw new OvrmndError({
              code: ErrorCode.ENDPOINT_NOT_FOUND,
              message: `Endpoint '${alias.endpoint}' referenced by alias '${endpointOrAlias}' not found`,
            })
          }
        }
        aliasParams = alias.args ?? {}
      } else {
        // Look for direct endpoint/operation
        if (isGraphQL) {
          operation = config.graphqlOperations?.find(
            op => op.name === endpointOrAlias,
          )
        } else {
          endpoint = config.endpoints?.find(
            e => e.name === endpointOrAlias,
          )
        }
      }

      if (!endpoint && !operation) {
        const type = isGraphQL ? 'operation' : 'endpoint'
        throw new OvrmndError({
          code: ErrorCode.ENDPOINT_NOT_FOUND,
          message: `${type} or alias '${endpointOrAlias}' not found in service '${service}'`,
          help: `Run 'ovrmnd list ${service}' to see available ${type}s and aliases`,
        })
      }

      // Handle GraphQL vs REST routing
      if (isGraphQL && operation) {
        // GraphQL operation
        if (args.batchJson) {
          await this.handleGraphQLBatchOperation(
            args,
            config,
            operation,
            aliasParams,
            formatter,
            debugFormatter,
          )
          return
        }

        // Single GraphQL operation
        const rawParams = this.parseRawParams(args)
        const mergedParams = this.mergeParams(
          aliasParams as RawParams,
          rawParams,
        )

        // Debug parameter mapping
        debugFormatter.formatParameterMapping(
          operation.name,
          mergedParams,
          mergedParams, // GraphQL uses variables directly
        )

        try {
          // Execute GraphQL operation
          const cache = new CacheStorage()
          const data = await executeGraphQLOperation<unknown>(
            config,
            operation,
            mergedParams,
            {
              debug: args.debug ?? false,
              cache,
            },
          )

          // Format as API response
          const response: ApiResponse = {
            success: true,
            data,
            metadata: {
              timestamp: Date.now(),
              statusCode: 200,
            },
          }

          // Output the response
          const output = formatter.formatApiResponse(response)
          process.stdout.write(`${output}\n`)
        } catch (error) {
          // Format GraphQL errors
          const errorOutput = formatter.formatError(error)
          console.error(errorOutput)
          process.exit(1)
        }
      } else if (endpoint) {
        // REST endpoint
        if (args.batchJson) {
          await this.handleBatchOperation(
            args,
            config,
            endpoint,
            aliasParams,
            formatter,
            debugFormatter,
          )
          return
        }

        // Single REST operation
        const rawParams = this.parseRawParams(args)
        const hints = this.createHints(args)
        const mergedParams = this.mergeParams(
          aliasParams as RawParams,
          rawParams,
        )

        // Map parameters
        const mappedParams = mapParameters(
          endpoint,
          mergedParams,
          hints,
        )

        // Debug parameter mapping
        debugFormatter.formatParameterMapping(
          endpoint.name,
          mergedParams,
          mappedParams,
        )

        // Make the API call
        const response = await callEndpoint(
          config,
          endpoint,
          mappedParams,
          debugFormatter,
        )

        // Output the response
        const output = formatter.formatApiResponse(response)
        process.stdout.write(`${output}\n`)

        if (!response.success) {
          process.exit(1)
        }
      }
    } catch (error) {
      // Use the same formatter for errors to ensure consistency
      const errorOutput = formatter.formatError(error)
      console.error(errorOutput)
      process.exit(1)
    }
  }

  private async handleBatchOperation(
    args: ArgumentsCamelCase<CallCommandArgs>,
    config: ServiceConfig,
    endpoint: EndpointConfig,
    aliasParams: Record<string, unknown>,
    formatter: OutputFormatter,
    debugFormatter: DebugFormatter,
  ): Promise<void> {
    // Parse batch JSON
    let batchParams: Record<string, unknown>[]
    try {
      const parsed = JSON.parse(args.batchJson!) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('Batch JSON must be an array')
      }
      batchParams = parsed as Record<string, unknown>[]
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.PARAM_INVALID,
        message: 'Invalid batch JSON format',
        details: error instanceof Error ? error.message : error,
        help: 'Provide a valid JSON array, e.g., --batch-json=\'[{"id": "1"}, {"id": "2"}]\'',
      })
    }

    if (batchParams.length === 0) {
      throw new OvrmndError({
        code: ErrorCode.PARAM_INVALID,
        message: 'Batch JSON array is empty',
        help: 'Provide at least one parameter set in the array',
      })
    }

    // Get CLI parameters that will override batch params
    const cliRawParams = this.parseRawParams(args)
    const hints = this.createHints(args)

    const results: ApiResponse[] = []
    const total = batchParams.length

    // Show progress in debug mode
    if (args.debug) {
      debugFormatter.info(
        `Starting batch operation with ${total} requests`,
      )
    }

    for (let i = 0; i < batchParams.length; i++) {
      const batchItem = batchParams[i]

      // Progress indication in debug mode
      if (args.debug) {
        debugFormatter.info(
          `Executing request ${i + 1} of ${total}...`,
        )
      }

      try {
        // Merge parameters: alias < batch < CLI
        const mergedParams = this.mergeParams(
          aliasParams as RawParams,
          this.convertToRawParams(batchItem ?? {}),
          cliRawParams,
        )

        // Map parameters
        const mappedParams = mapParameters(
          endpoint,
          mergedParams,
          hints,
        )

        // Debug parameter mapping for each request
        if (args.debug) {
          debugFormatter.formatParameterMapping(
            `${endpoint.name} [${i + 1}/${total}]`,
            mergedParams,
            mappedParams,
          )
        }

        // Make the API call
        const response = await callEndpoint(
          config,
          endpoint,
          mappedParams,
          debugFormatter,
        )

        results.push(response)

        // Check fail-fast mode
        if (args.failFast && !response.success) {
          if (args.debug) {
            debugFormatter.warning(
              `Stopping batch operation due to error (fail-fast mode)`,
            )
          }
          break
        }
      } catch (error) {
        // Convert error to ApiResponse format
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code:
              error instanceof OvrmndError
                ? error.code
                : 'UNKNOWN_ERROR',
            message:
              error instanceof Error ? error.message : String(error),
            details:
              error instanceof OvrmndError
                ? error.details
                : undefined,
          },
        }
        results.push(errorResponse)

        // Check fail-fast mode
        if (args.failFast) {
          if (args.debug) {
            debugFormatter.warning(
              `Stopping batch operation due to error (fail-fast mode)`,
            )
          }
          break
        }
      }
    }

    // Format and output batch results
    this.outputBatchResults(results, formatter)

    // Exit with error if any request failed
    const hasErrors = results.some(r => !r.success)
    if (hasErrors) {
      process.exit(1)
    }
  }

  private outputBatchResults(
    results: ApiResponse[],
    formatter: OutputFormatter,
  ): void {
    if (formatter.isJson()) {
      // JSON mode: output array of results
      const jsonResults = results.map(r => {
        if (r.success && r.data !== undefined) {
          return { success: true, data: r.data }
        } else {
          return { success: false, error: r.error }
        }
      })
      process.stdout.write(
        `${JSON.stringify(jsonResults, null, 2)}\n`,
      )
    } else {
      // Pretty mode: format each result
      const successCount = results.filter(r => r.success).length
      const errorCount = results.length - successCount

      results.forEach((result, index) => {
        process.stdout.write(
          `\n${formatter.dim(`=== Request ${index + 1}/${results.length} ===`)}\n`,
        )

        if (result.success) {
          process.stdout.write(`${formatter.success('Success')}\n`)
          if (result.data !== undefined) {
            process.stdout.write(`${formatter.format(result.data)}\n`)
          }
        } else {
          process.stdout.write(`${formatter.error('Failed')}\n`)
          if (result.error) {
            process.stdout.write(
              `${formatter.formatError(
                new OvrmndError({
                  code: result.error.code as ErrorCode,
                  message: result.error.message,
                  details: result.error.details,
                }),
              )}\n`,
            )
          }
        }
      })

      // Summary
      process.stdout.write(
        `\n${formatter.dim(
          'Summary:',
        )} ${successCount} succeeded, ${errorCount} failed\n`,
      )
    }
  }

  private parseRawParams(
    args: ArgumentsCamelCase<CallCommandArgs>,
  ): RawParams {
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

    return rawParams
  }

  private createHints(
    args: ArgumentsCamelCase<CallCommandArgs>,
  ): ParamHints {
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

    return {
      pathParams: Object.keys(pathParams),
      queryParams: Object.keys(queryParams),
      headerParams: Object.keys(headerParams),
      bodyParams: Object.keys(bodyParams),
    }
  }

  private mergeParams(...paramSets: RawParams[]): RawParams {
    const mergedParams: RawParams = {}

    // Merge in order - later params override earlier ones
    for (const params of paramSets) {
      for (const [key, value] of Object.entries(params)) {
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
    }

    return mergedParams
  }

  private convertToRawParams(
    obj: Record<string, unknown>,
  ): RawParams {
    const rawParams: RawParams = {}

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value)
      ) {
        rawParams[key] = value
      } else if (value !== null && value !== undefined) {
        rawParams[key] = String(value)
      }
    }

    return rawParams
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

  private async handleGraphQLBatchOperation(
    args: ArgumentsCamelCase<CallCommandArgs>,
    config: ServiceConfig,
    operation: GraphQLOperationConfig,
    aliasParams: Record<string, unknown>,
    formatter: OutputFormatter,
    debugFormatter: DebugFormatter,
  ): Promise<void> {
    // Parse batch JSON
    let batchParams: Record<string, unknown>[]
    try {
      const parsed = JSON.parse(args.batchJson!) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('Batch JSON must be an array')
      }
      batchParams = parsed as Record<string, unknown>[]
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.PARAM_INVALID,
        message: 'Invalid batch JSON format',
        details: error instanceof Error ? error.message : error,
        help: 'Provide a valid JSON array, e.g., --batch-json=\'[{"id": "1"}, {"id": "2"}]\'',
      })
    }

    if (batchParams.length === 0) {
      throw new OvrmndError({
        code: ErrorCode.PARAM_INVALID,
        message: 'Batch JSON array is empty',
        help: 'Provide at least one parameter set in the array',
      })
    }

    // Get CLI parameters that will override batch params
    const cliRawParams = this.parseRawParams(args)
    const cache = new CacheStorage()

    const results: ApiResponse[] = []
    const total = batchParams.length

    // Show progress in debug mode
    if (args.debug) {
      debugFormatter.info(
        `Starting GraphQL batch operation with ${total} requests`,
      )
    }

    for (let i = 0; i < batchParams.length; i++) {
      const batchItem = batchParams[i]

      // Progress indication in debug mode
      if (args.debug) {
        debugFormatter.info(
          `Executing GraphQL request ${i + 1} of ${total}...`,
        )
      }

      try {
        // Merge parameters: alias < batch < CLI
        const mergedParams = this.mergeParams(
          aliasParams as RawParams,
          this.convertToRawParams(batchItem ?? {}),
          cliRawParams,
        )

        // Debug parameter mapping for each request
        if (args.debug) {
          debugFormatter.formatParameterMapping(
            `${operation.name} [${i + 1}/${total}]`,
            mergedParams,
            mergedParams, // GraphQL uses variables directly
          )
        }

        // Execute GraphQL operation
        const data = await executeGraphQLOperation<unknown>(
          config,
          operation,
          mergedParams,
          {
            debug: args.debug ?? false,
            cache,
          },
        )

        // Format as API response
        const response: ApiResponse = {
          success: true,
          data,
          metadata: {
            timestamp: Date.now(),
            statusCode: 200,
          },
        }

        results.push(response)
      } catch (error) {
        // Convert error to ApiResponse format
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code:
              error instanceof OvrmndError
                ? error.code
                : 'UNKNOWN_ERROR',
            message:
              error instanceof Error ? error.message : String(error),
            details:
              error instanceof OvrmndError
                ? error.details
                : undefined,
          },
        }
        results.push(errorResponse)

        // Check fail-fast mode
        if (args.failFast) {
          if (args.debug) {
            debugFormatter.warning(
              `Stopping GraphQL batch operation due to error (fail-fast mode)`,
            )
          }
          break
        }
      }
    }

    // Format and output batch results
    this.outputBatchResults(results, formatter)

    // Exit with error if any request failed
    const hasErrors = results.some(r => !r.success)
    if (hasErrors) {
      process.exit(1)
    }
  }
}
