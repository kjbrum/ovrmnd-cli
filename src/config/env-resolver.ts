import * as dotenv from 'dotenv'
import type {
  ServiceConfig,
  ResolvedServiceConfig,
  AuthConfig,
  ResolvedAuthConfig,
} from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import logger from '../utils/logger'

// Load .env file on module load
dotenv.config()

/**
 * Regular expression to match ${VAR_NAME} patterns
 */
const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g

/**
 * Resolve environment variables in a string
 */
export function resolveEnvVars(value: string): string {
  return value.replace(ENV_VAR_PATTERN, (_match, varName: string) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      throw new OvrmndError({
        code: ErrorCode.ENV_VAR_NOT_FOUND,
        message: `Environment variable ${varName} is not defined`,
      })
    }
    logger.debug(`Resolved environment variable ${varName}`)
    return envValue
  })
}

/**
 * Resolve environment variables in an object recursively
 */
export function resolveEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T
  }

  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return obj.map(item => resolveEnvVarsInObject(item)) as any
  }

  if (obj !== null && typeof obj === 'object') {
    const resolved: Record<string, unknown> = {}
    const objRecord = obj as Record<string, unknown>
    for (const [key, value] of Object.entries(objRecord)) {
      resolved[key] = resolveEnvVarsInObject(value)
    }
    return resolved as T
  }

  return obj
}

/**
 * Resolve authentication configuration
 */
function resolveAuthConfig(auth: AuthConfig): ResolvedAuthConfig {
  return {
    ...auth,
    token: resolveEnvVars(auth.token),
  }
}

/**
 * Resolve all environment variables in a service configuration
 */
export function resolveServiceConfig(
  config: ServiceConfig,
): ResolvedServiceConfig {
  const resolved: ResolvedServiceConfig = {
    ...config,
    baseUrl: resolveEnvVars(config.baseUrl),
  }

  // Resolve authentication if present
  if (config.authentication) {
    resolved.authentication = resolveAuthConfig(config.authentication)
  }

  // Resolve environment variables in endpoints
  resolved.endpoints = config.endpoints.map(endpoint => {
    const resolvedEndpoint = {
      ...endpoint,
      path: resolveEnvVars(endpoint.path),
    }

    if (endpoint.headers) {
      resolvedEndpoint.headers = resolveEnvVarsInObject(
        endpoint.headers,
      )
    }

    if (endpoint.defaultParams) {
      resolvedEndpoint.defaultParams = resolveEnvVarsInObject(
        endpoint.defaultParams,
      )
    }

    return resolvedEndpoint
  })

  // Resolve environment variables in aliases
  if (config.aliases) {
    resolved.aliases = config.aliases.map(alias => ({
      ...alias,
      args: alias.args
        ? resolveEnvVarsInObject(alias.args)
        : undefined,
    }))
  }

  return resolved
}

/**
 * Check if a string contains environment variable placeholders
 */
export function hasEnvVarPlaceholders(value: string): boolean {
  return ENV_VAR_PATTERN.test(value)
}

/**
 * Get list of environment variable names from a string
 */
export function getEnvVarNames(value: string): string[] {
  const matches = Array.from(value.matchAll(ENV_VAR_PATTERN))
  return matches.map(match => match[1] as string)
}
