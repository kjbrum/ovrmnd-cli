import type {
  ResolvedServiceConfig,
  EndpointConfig,
  HttpMethod,
} from '../types/config'
import type { ApiResponse as StandardApiResponse } from '../types'
import { OvrmndError, ErrorCode } from '../utils/error'
import logger from '../utils/logger'
import { applyAuth, redactAuth } from './auth'
import type { DebugFormatter } from '../utils/debug'

/**
 * API request options
 */
export interface RequestOptions {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

/**
 * HTTP response from the API
 */
export interface HttpResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: {
    message: string
    code?: string
    details?: unknown
  }
  status: number
  statusText: string
  headers: Record<string, string>
}

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 30000 // 30 seconds

/**
 * Convert Headers object to plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

/**
 * Build full URL with base URL and path
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams?: Record<string, string>,
): string {
  // Replace path parameters
  let resolvedPath = path
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedPath = resolvedPath.replace(
        `{${key}}`,
        encodeURIComponent(value),
      )
    }
  }

  // Ensure proper URL construction
  const normalizedBase = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl
  const normalizedPath = resolvedPath.startsWith('/')
    ? resolvedPath
    : `/${resolvedPath}`

  return `${normalizedBase}${normalizedPath}`
}

/**
 * Execute an API request
 */
export async function executeRequest<T = unknown>(
  options: RequestOptions,
  debugFormatter?: DebugFormatter,
): Promise<HttpResponse<T>> {
  const {
    method,
    url,
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
  } = options

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // Use debug formatter if provided, otherwise fall back to logger
    if (debugFormatter?.isEnabled) {
      debugFormatter.formatRequest(method, url, headers, body)
    } else {
      logger.debug(`${method} ${url}`, {
        headers: redactAuth(headers),
        hasBody: body !== undefined,
      })
    }

    const requestInit: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    }

    // Add body if present
    if (body !== undefined) {
      if (headers['Content-Type'] === 'application/json') {
        requestInit.body = JSON.stringify(body)
      } else if (typeof body === 'string') {
        requestInit.body = body
      } else {
        requestInit.body = JSON.stringify(body)
        headers['Content-Type'] = 'application/json'
      }
    }

    const response = await fetch(url, requestInit)

    // Get response data
    let data: T
    const contentType = response.headers.get('Content-Type') ?? ''

    if (contentType.includes('application/json')) {
      data = (await response.json()) as T
    } else {
      data = (await response.text()) as T
    }

    const responseHeaders = headersToObject(response.headers)

    // Check for HTTP errors
    if (!response.ok) {
      throw new OvrmndError({
        code: ErrorCode.API_REQUEST_FAILED,
        message: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        details: data,
        context: {
          request: {
            method,
            url,
            headers: redactAuth(headers),
            body,
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: data,
          },
        },
      })
    }

    // Log response with debug formatter
    if (debugFormatter?.isEnabled) {
      debugFormatter.formatResponse(
        response.status,
        response.statusText,
        responseHeaders,
        data,
      )
    } else {
      logger.debug(`Response ${response.status}`, {
        hasData: data !== undefined,
      })
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    }
  } catch (error) {
    if (error instanceof OvrmndError) {
      throw error
    }

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OvrmndError({
        code: ErrorCode.API_TIMEOUT,
        message: `Request timeout after ${timeout}ms`,
        context: {
          request: {
            method,
            url,
            headers: redactAuth(headers),
            body,
          },
        },
      })
    }

    // Handle network errors
    if (
      error instanceof TypeError &&
      error.message.includes('fetch')
    ) {
      throw new OvrmndError({
        code: ErrorCode.API_REQUEST_FAILED,
        message: `Network error: ${error.message}`,
        context: {
          request: {
            method,
            url,
            headers: redactAuth(headers),
            body,
          },
        },
      })
    }

    // Generic error
    throw new OvrmndError({
      code: ErrorCode.API_REQUEST_FAILED,
      message:
        error instanceof Error ? error.message : 'Unknown error',
      details: { url, method, error },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Execute an API call for a specific endpoint
 */
export async function callEndpoint<T = unknown>(
  config: ResolvedServiceConfig,
  endpoint: EndpointConfig,
  params?: {
    path?: Record<string, string>
    query?: Record<string, string | string[]>
    body?: unknown
    headers?: Record<string, string>
  },
  debugFormatter?: DebugFormatter,
): Promise<StandardApiResponse> {
  // Build URL
  const url = buildUrl(config.baseUrl, endpoint.path, params?.path)

  // Add query parameters
  const urlObj = new URL(url)
  if (params?.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (Array.isArray(value)) {
        value.forEach(v => urlObj.searchParams.append(key, v))
      } else {
        urlObj.searchParams.set(key, value)
      }
    }
  }

  // Merge headers
  const headers: Record<string, string> = {
    ...endpoint.headers,
    ...params?.headers,
  }

  // Apply authentication
  const authHeaders = applyAuth(config, headers)

  // Check cache if GET request (placeholder for future implementation)
  if (endpoint.method === 'GET' && endpoint.cacheTTL && debugFormatter?.isEnabled) {
    // For now, just log that caching would be checked
    const cacheKey = `${config.serviceName}.${endpoint.name}:${JSON.stringify(params?.path ?? {})}:${JSON.stringify(params?.query ?? {})}`
    debugFormatter.formatCacheInfo(endpoint.name, cacheKey, false, endpoint.cacheTTL)
  }

  // Execute request
  try {
    const httpResponse = await executeRequest<T>(
      {
        method: endpoint.method,
        url: urlObj.toString(),
        headers: authHeaders,
        body: params?.body,
      },
      debugFormatter,
    )

    // Transform to standard ApiResponse format
    return {
      success: true,
      data: httpResponse.data,
      metadata: {
        timestamp: Date.now(),
        statusCode: httpResponse.status,
      },
    }
  } catch (error) {
    if (error instanceof OvrmndError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }
    }

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message:
          error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}
