import * as dotenv from 'dotenv'
import type {
  ServiceConfig,
  ResolvedServiceConfig,
  AuthConfig,
  ResolvedAuthConfig,
} from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import logger from '../utils/logger'
import type { DebugFormatter } from '../utils/debug'

// Load .env file on module load
dotenv.config()

/**
 * Regular expression to match ${VAR_NAME} patterns
 */
const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g

/**
 * Resolve environment variables in a string
 */
export function resolveEnvVars(
  value: string,
  debugFormatter?: DebugFormatter,
): string {
  return value.replace(ENV_VAR_PATTERN, (_match, varName: string) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      if (debugFormatter?.isEnabled) {
        debugFormatter.formatEnvResolution(varName, false)
      }
      throw new OvrmndError({
        code: ErrorCode.ENV_VAR_NOT_FOUND,
        message: `Environment variable ${varName} is not defined`,
      })
    }
    if (debugFormatter?.isEnabled) {
      debugFormatter.formatEnvResolution(varName, true, envValue)
    } else {
      logger.debug(`Resolved environment variable ${varName}`)
    }
    return envValue
  })
}

/**
 * Resolve environment variables in an object recursively
 */
export function resolveEnvVarsInObject<T>(
  obj: T,
  debugFormatter?: DebugFormatter,
): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj, debugFormatter) as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) =>
      resolveEnvVarsInObject(item, debugFormatter),
    ) as unknown as T
  }

  if (obj !== null && typeof obj === 'object') {
    const resolved: Record<string, unknown> = {}
    const objRecord = obj as Record<string, unknown>
    for (const [key, value] of Object.entries(objRecord)) {
      resolved[key] = resolveEnvVarsInObject(value, debugFormatter)
    }
    return resolved as T
  }

  return obj
}

/**
 * Resolve authentication configuration
 */
function resolveAuthConfig(
  auth: AuthConfig,
  debugFormatter?: DebugFormatter,
): ResolvedAuthConfig {
  return {
    ...auth,
    token: resolveEnvVars(auth.token, debugFormatter),
  }
}

/**
 * Resolve all environment variables in a service configuration
 */
export function resolveServiceConfig(
  config: ServiceConfig,
  debugFormatter?: DebugFormatter,
): ResolvedServiceConfig {
  const resolved: ResolvedServiceConfig = {
    ...config,
    baseUrl: resolveEnvVars(config.baseUrl, debugFormatter),
  }

  // Resolve authentication if present
  if (config.authentication) {
    resolved.authentication = resolveAuthConfig(
      config.authentication,
      debugFormatter,
    )
  }

  // Resolve environment variables in endpoints
  if (config.endpoints) {
    resolved.endpoints = config.endpoints.map(endpoint => {
    const resolvedEndpoint = {
      ...endpoint,
      path: resolveEnvVars(endpoint.path, debugFormatter),
    }

    if (endpoint.headers) {
      resolvedEndpoint.headers = resolveEnvVarsInObject(
        endpoint.headers,
        debugFormatter,
      )
    }

    if (endpoint.defaultParams) {
      resolvedEndpoint.defaultParams = resolveEnvVarsInObject(
        endpoint.defaultParams,
        debugFormatter,
      )
    }

    return resolvedEndpoint
  })
  }

  // Resolve environment variables in aliases
  if (config.aliases) {
    resolved.aliases = config.aliases.map(alias => ({
      ...alias,
      args: alias.args
        ? resolveEnvVarsInObject(alias.args, debugFormatter)
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
