/**
 * Configuration types for Ovrmnd CLI YAML schema
 */

import type { GraphQLOperationConfig } from './graphql.js'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type AuthType = 'bearer' | 'apikey'
export type ApiType = 'rest' | 'graphql'

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: AuthType
  token: string // Can contain ${ENV_VAR} placeholders
  header?: string | undefined // Custom header name for API key auth
}

/**
 * Transform configuration for response modification
 */
export interface TransformConfig {
  fields?: string[] | undefined // Fields to extract (supports dot notation and array patterns)
  rename?: Record<string, string> | undefined // Field renaming map (oldPath: newPath)
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
  transform?: TransformConfig | TransformConfig[] | undefined // Single or pipeline of transformations
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
  apiType?: ApiType | undefined // Defaults to 'rest'
  authentication?: AuthConfig | undefined
  endpoints?: EndpointConfig[] | undefined // Optional for GraphQL services
  graphqlEndpoint?: string | undefined // GraphQL endpoint path (e.g., /graphql)
  graphqlOperations?: GraphQLOperationConfig[] | undefined // GraphQL operations
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
