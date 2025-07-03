/**
 * Configuration types for Ovrmnd CLI YAML schema
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type AuthType = 'bearer' | 'apikey'

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: AuthType
  token: string // Can contain ${ENV_VAR} placeholders
  header?: string | undefined // Custom header name for API key auth
}

/**
 * Individual endpoint configuration
 */
export interface EndpointConfig {
  name: string
  method: HttpMethod
  path: string // URL path with {param} placeholders
  cacheTTL?: number | undefined // Cache duration in seconds
  headers?: Record<string, string> | undefined
  defaultParams?: Record<string, unknown> | undefined
}

/**
 * Alias configuration for shortcuts
 */
export interface AliasConfig {
  name: string
  endpoint: string
  args?: Record<string, unknown> | undefined
}

/**
 * Main service configuration
 */
export interface ServiceConfig {
  serviceName: string
  baseUrl: string
  authentication?: AuthConfig | undefined
  endpoints: EndpointConfig[]
  aliases?: AliasConfig[] | undefined
}

/**
 * Resolved configuration after environment variable interpolation
 */
export interface ResolvedServiceConfig extends ServiceConfig {
  authentication?: ResolvedAuthConfig | undefined
}

export interface ResolvedAuthConfig
  extends Omit<AuthConfig, 'token'> {
  token: string // Resolved token without ${} placeholders
}

/**
 * Configuration file metadata
 */
export interface ConfigFile {
  path: string
  config: ServiceConfig
  isGlobal: boolean
}

/**
 * Merged configuration result
 */
export interface MergedConfig {
  services: Map<string, ServiceConfig>
  globalConfigs: ConfigFile[]
  localConfigs: ConfigFile[]
}
