import type { EndpointConfig } from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import { extractPathParameters } from '../config/validator'
import logger from '../utils/logger'

/**
 * Raw parameters from CLI or alias
 */
export interface RawParams {
  [key: string]: string | string[] | boolean | number | undefined
}

/**
 * Mapped parameters for API call
 */
export interface MappedParams {
  path: Record<string, string>
  query: Record<string, string | string[]>
  headers: Record<string, string>
  body?: unknown
}

/**
 * Parameter mapping hints
 */
export interface ParamHints {
  pathParams?: string[]
  queryParams?: string[]
  headerParams?: string[]
  bodyParams?: string[]
}

/**
 * Map raw parameters to appropriate locations
 */
export function mapParameters(
  endpoint: EndpointConfig,
  rawParams: RawParams,
  hints?: ParamHints,
): MappedParams {
  const result: MappedParams = {
    path: {},
    query: {},
    headers: {},
  }

  // Extract required path parameters
  const pathParams = extractPathParameters(endpoint.path)
  const usedParams = new Set<string>()

  // 1. Map path parameters first (highest priority)
  for (const param of pathParams) {
    if (param in rawParams) {
      result.path[param] = String(rawParams[param])
      usedParams.add(param)
    } else {
      throw new OvrmndError({
        code: ErrorCode.PARAM_REQUIRED,
        message: `Missing required path parameter: ${param}`,
        help: `Provide --${param} <value>`,
      })
    }
  }

  // 2. Map explicitly hinted parameters
  if (hints) {
    // Header parameters
    if (hints.headerParams) {
      for (const param of hints.headerParams) {
        if (param in rawParams && !usedParams.has(param)) {
          result.headers[param] = String(rawParams[param])
          usedParams.add(param)
        }
      }
    }

    // Query parameters
    if (hints.queryParams) {
      for (const param of hints.queryParams) {
        if (param in rawParams && !usedParams.has(param)) {
          const value = rawParams[param]
          if (Array.isArray(value)) {
            result.query[param] = value.map(String)
          } else {
            result.query[param] = String(value)
          }
          usedParams.add(param)
        }
      }
    }

    // Body parameters
    if (hints.bodyParams && hints.bodyParams.length > 0) {
      const bodyData: Record<string, unknown> = {}
      for (const param of hints.bodyParams) {
        if (param in rawParams && !usedParams.has(param)) {
          bodyData[param] = rawParams[param]
          usedParams.add(param)
        }
      }
      if (Object.keys(bodyData).length > 0) {
        result.body = bodyData
      }
    }
  }

  // 3. Apply default parameter mapping for remaining params
  for (const [key, value] of Object.entries(rawParams)) {
    if (!usedParams.has(key) && value !== undefined) {
      // Skip internal parameters
      if (key.startsWith('_') || key === '$0') {
        continue
      }

      // For GET/DELETE, params go to query string
      // For POST/PUT/PATCH, params go to body
      if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
        if (Array.isArray(value)) {
          result.query[key] = value.map(String)
        } else {
          result.query[key] = String(value)
        }
      } else {
        // Add to body
        if (!result.body) {
          result.body = {}
        }
        ;(result.body as Record<string, unknown>)[key] = value
      }
    }
  }

  // 4. Merge with endpoint default params
  if (endpoint.defaultParams) {
    for (const [key, value] of Object.entries(
      endpoint.defaultParams,
    )) {
      // Only add defaults if not already provided
      if (!pathParams.includes(key) && !(key in rawParams)) {
        if (
          endpoint.method === 'GET' ||
          endpoint.method === 'DELETE'
        ) {
          result.query[key] = String(value)
        } else {
          if (!result.body) {
            result.body = {}
          }
          ;(result.body as Record<string, unknown>)[key] = value
        }
      }
    }
  }

  logger.debug('Mapped parameters', {
    endpoint: endpoint.name,
    pathParams: Object.keys(result.path),
    queryParams: Object.keys(result.query),
    headerParams: Object.keys(result.headers),
    hasBody: result.body !== undefined,
  })

  return result
}

/**
 * Parse CLI arguments into raw parameters
 */
export function parseCliArgs(argv: string[]): RawParams {
  const params: RawParams = {}

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]

    if (arg?.startsWith('--')) {
      const key = arg.slice(2)
      const nextArg = argv[i + 1]

      // Check if next arg is a value or another flag
      if (!nextArg || nextArg.startsWith('--')) {
        // Boolean flag
        params[key] = true
        i++
      } else {
        // Check if we already have this key (for arrays)
        const existing = params[key]
        if (existing !== undefined) {
          // Convert to array if not already
          if (Array.isArray(existing)) {
            existing.push(nextArg)
          } else {
            params[key] = [String(existing), nextArg]
          }
        } else {
          // Try to parse as number
          const numValue = Number(nextArg)
          if (!isNaN(numValue) && nextArg.trim() !== '') {
            params[key] = numValue
          } else {
            params[key] = nextArg
          }
        }
        i += 2
      }
    } else {
      // Positional argument
      if (!params['_']) {
        params['_'] = []
      }
      ;(params['_'] as string[]).push(arg ?? '')
      i++
    }
  }

  return params
}

/**
 * Merge parameters with alias defaults
 */
export function mergeWithAlias(
  aliasArgs: Record<string, unknown>,
  cliParams: RawParams,
): RawParams {
  // CLI params override alias defaults
  const merged: RawParams = {}

  // Add alias args
  for (const [key, value] of Object.entries(aliasArgs)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value) ||
      value === undefined
    ) {
      merged[key] = value as
        | string
        | string[]
        | boolean
        | number
        | undefined
    }
  }

  // Override with CLI params
  for (const [key, value] of Object.entries(cliParams)) {
    merged[key] = value
  }

  return merged
}
