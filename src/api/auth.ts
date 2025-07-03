import type {
  ResolvedAuthConfig,
  ResolvedServiceConfig,
} from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import logger from '../utils/logger'

/**
 * Authentication header types
 */
export interface AuthHeaders {
  [key: string]: string
}

/**
 * Apply authentication to request headers
 */
export function applyAuth(
  config: ResolvedServiceConfig,
  headers: AuthHeaders = {},
): AuthHeaders {
  if (!config.authentication) {
    logger.debug('No authentication configured')
    return headers
  }

  const auth = config.authentication
  const authHeaders = { ...headers }

  switch (auth.type) {
    case 'bearer':
      authHeaders['Authorization'] = `Bearer ${auth.token}`
      logger.debug('Applied Bearer token authentication')
      break

    case 'apikey': {
      const headerName = auth.header ?? 'X-API-Key'
      authHeaders[headerName] = auth.token
      logger.debug(
        `Applied API key authentication to header: ${headerName}`,
      )
      break
    }

    default:
      // This should never happen if types are correct
      throw new OvrmndError({
        code: ErrorCode.AUTH_INVALID,
        message: `Unknown authentication type`,
      })
  }

  return authHeaders
}

/**
 * Apply API key authentication to query parameters
 */
export function applyApiKeyToQuery(
  auth: ResolvedAuthConfig,
  params: URLSearchParams,
  keyName = 'api_key',
): URLSearchParams {
  if (auth.type !== 'apikey') {
    throw new OvrmndError({
      code: ErrorCode.AUTH_INVALID,
      message:
        'Query parameter authentication only supports API key type',
    })
  }

  const newParams = new URLSearchParams(params)
  newParams.set(keyName, auth.token)
  logger.debug(`Applied API key to query parameter: ${keyName}`)

  return newParams
}

/**
 * Check if authentication is required
 */
export function isAuthRequired(
  config: ResolvedServiceConfig,
): boolean {
  return config.authentication !== undefined
}

/**
 * Validate authentication configuration
 */
export function validateAuth(config: ResolvedServiceConfig): void {
  if (!config.authentication) {
    return
  }

  const auth = config.authentication

  if (!auth.token || auth.token.trim() === '') {
    throw new OvrmndError({
      code: ErrorCode.AUTH_MISSING,
      message: 'Authentication token is empty',
      help: 'Ensure the environment variable for the token is set',
    })
  }

  if (auth.type === 'apikey' && auth.header) {
    // Validate custom header name
    if (!/^[a-zA-Z0-9-]+$/.test(auth.header)) {
      throw new OvrmndError({
        code: ErrorCode.AUTH_INVALID,
        message: `Invalid header name: ${auth.header}`,
        help: 'Header names should only contain letters, numbers, and hyphens',
      })
    }
  }
}

/**
 * Redact sensitive authentication data for logging
 */
export function redactAuth(headers: AuthHeaders): AuthHeaders {
  const redacted = { ...headers }

  // Common auth headers to redact
  const sensitiveHeaders = [
    'Authorization',
    'X-API-Key',
    'X-Api-Key',
    'API-Key',
    'Api-Key',
    'X-Auth-Token',
    'X-Access-Token',
  ]

  for (const [key, value] of Object.entries(redacted)) {
    if (
      sensitiveHeaders.some(
        h => h.toLowerCase() === key.toLowerCase(),
      )
    ) {
      // Keep first 4 chars and last 4 chars visible
      if (value.length > 12) {
        redacted[key] = `${value.slice(0, 4)}...${value.slice(-4)}`
      } else {
        redacted[key] = '***REDACTED***'
      }
    }
  }

  return redacted
}
