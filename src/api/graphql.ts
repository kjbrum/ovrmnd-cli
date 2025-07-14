import type { ResolvedServiceConfig } from '../types/config.js'
import type {
  GraphQLOperationConfig,
  GraphQLRequest,
  GraphQLResponse,
} from '../types/graphql.js'
import { GraphQLHttpError } from '../types/graphql.js'
import { OvrmndError, ErrorCode } from '../utils/error.js'
import { DebugFormatter } from '../utils/debug-formatter.js'
import type { CacheStorage } from '../services/cache-storage.js'
import { ResponseTransformer } from '../services/response-transformer.js'
import { applyAuth } from './auth.js'

/**
 * Execute a GraphQL operation
 */
export async function executeGraphQLOperation<T = unknown>(
  service: ResolvedServiceConfig,
  operation: GraphQLOperationConfig,
  variables: Record<string, unknown>,
  options: {
    debug?: boolean
    cache?: CacheStorage
  } = {},
): Promise<T> {
  const { debug = false, cache } = options
  const debugFormatter = debug ? new DebugFormatter() : null

  // Validate service has GraphQL endpoint
  if (!service.graphqlEndpoint) {
    throw new OvrmndError({
      code: ErrorCode.CONFIG_INVALID,
      message: 'Service does not have a GraphQL endpoint configured',
      details: {
        service: service.serviceName,
      },
      help: 'Add "graphqlEndpoint" to your service configuration',
    })
  }

  // Build the GraphQL request
  const request: GraphQLRequest = buildGraphQLRequest(
    operation,
    variables,
  )

  if (debugFormatter) {
    debugFormatter.section('GraphQL Operation')
    debugFormatter.log('Operation', operation.name)
    debugFormatter.log('Type', operation.operationType ?? 'query')
    debugFormatter.log(
      'Variables',
      JSON.stringify(variables, null, 2),
    )
  }

  // Build the URL
  const url = new URL(
    service.graphqlEndpoint,
    service.baseUrl,
  ).toString()

  // Check cache for queries
  const isQuery =
    !operation.operationType || operation.operationType === 'query'
  if (isQuery && operation.cacheTTL && cache) {
    const cacheKey = cache.generateKey(url, request)
    const cachedResponse = cache.get(cacheKey) as T | null

    if (cachedResponse) {
      if (debugFormatter) {
        debugFormatter.log('Cache', 'HIT')
      }
      return cachedResponse
    }

    if (debugFormatter) {
      debugFormatter.log('Cache', 'MISS')
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'ovrmnd-cli',
  }

  // Apply authentication
  if (service.authentication) {
    applyAuth(headers, url, service.authentication)
  }

  if (debugFormatter) {
    debugFormatter.section('GraphQL Request')
    debugFormatter.log('URL', url)
    debugFormatter.log('Headers', sanitizeHeaders(headers))
    debugFormatter.log('Body', JSON.stringify(request, null, 2))
  }

  try {
    // Execute the request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    const responseText = await response.text()
    let responseData: GraphQLResponse<T>

    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      throw new OvrmndError({
        code: ErrorCode.API_RESPONSE_INVALID,
        message: 'Invalid JSON response from GraphQL endpoint',
        details: {
          response: responseText,
          statusCode: response.status,
        },
      })
    }

    if (debugFormatter) {
      debugFormatter.section('GraphQL Response')
      debugFormatter.log('Status', response.status.toString())
      debugFormatter.log(
        'Body',
        JSON.stringify(responseData, null, 2),
      )
    }

    // Check for GraphQL errors
    if (responseData.errors && responseData.errors.length > 0) {
      const mainError = responseData.errors[0]
      throw new GraphQLHttpError(
        mainError.message,
        response.status,
        responseData,
        request,
      )
    }

    // Check for HTTP errors
    if (!response.ok) {
      throw new GraphQLHttpError(
        `GraphQL endpoint returned status ${response.status}`,
        response.status,
        responseData,
        request,
      )
    }

    // Extract data
    let result = responseData.data as T

    // Apply transformations if configured
    if (operation.transform && result !== undefined) {
      const transformer = new ResponseTransformer()
      const transforms = Array.isArray(operation.transform)
        ? operation.transform
        : [operation.transform]

      for (const transform of transforms) {
        result = transformer.transform(result, transform) as T
      }
    }

    // Cache successful query responses
    if (
      isQuery &&
      operation.cacheTTL &&
      cache &&
      result !== undefined
    ) {
      const cacheKey = cache.generateKey(url, request)
      cache.set(cacheKey, result as unknown, operation.cacheTTL, {
        service: service.serviceName,
        endpoint: operation.name,
      })
    }

    return result
  } catch (error) {
    // Re-throw GraphQL errors
    if (error instanceof GraphQLHttpError) {
      throw error
    }

    // Handle fetch errors
    if (error instanceof Error) {
      const errorContext: Record<string, unknown> = {
        operation: operation.name,
        service: service.serviceName,
        url,
      }

      if (error.name === 'AbortError') {
        throw new OvrmndError({
          code: ErrorCode.API_TIMEOUT,
          message: 'GraphQL request timed out',
          details: errorContext,
        })
      }

      throw new OvrmndError({
        code: ErrorCode.API_REQUEST_FAILED,
        message: `GraphQL request failed: ${error.message}`,
        details: errorContext,
      })
    }

    throw error
  }
}

/**
 * Build a GraphQL request from operation config and variables
 */
export function buildGraphQLRequest(
  operation: GraphQLOperationConfig,
  variables: Record<string, unknown>,
): GraphQLRequest {
  // Merge default variables with provided variables
  const mergedVariables = {
    ...operation.variables,
    ...variables,
  }

  // Extract operation name from the query if it exists
  const operationNameMatch = operation.query.match(
    /^(?:query|mutation)\s+(\w+)/,
  )
  const operationName = operationNameMatch
    ? operationNameMatch[1]
    : undefined

  return {
    query: operation.query,
    variables:
      Object.keys(mergedVariables).length > 0
        ? mergedVariables
        : undefined,
    operationName,
  }
}

/**
 * Parse GraphQL errors for better display
 */
export function parseGraphQLErrors(
  errors: GraphQLResponse['errors'],
): string[] {
  if (!errors || errors.length === 0) {
    return []
  }

  return errors.map(error => {
    let message = error.message

    if (error.path) {
      message += ` at path: ${error.path.join('.')}`
    }

    if (error.locations && error.locations.length > 0) {
      const loc = error.locations[0]
      message += ` (line ${loc.line}, column ${loc.column})`
    }

    return message
  })
}

/**
 * Sanitize headers for debug output
 */
function sanitizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sanitized = { ...headers }

  // Redact authorization header
  if (sanitized.Authorization) {
    sanitized.Authorization = `${sanitized.Authorization.substring(0, 10)}...`
  }

  // Redact any API key headers
  for (const key of Object.keys(sanitized)) {
    if (
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token')
    ) {
      sanitized[key] = `${sanitized[key].substring(0, 10)}...`
    }
  }

  return sanitized
}
