export interface ServiceConfig {
  serviceName: string
  baseUrl: string
  authentication?: AuthConfig
  endpoints: EndpointConfig[]
  aliases?: AliasConfig[]
}

export interface AuthConfig {
  type: 'bearer' | 'apiKey'
  token?: string
  header?: string
  queryParam?: string
}

export interface EndpointConfig {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description?: string
  parameters?: ParameterConfig[]
  cacheTTL?: number
  transform?: TransformConfig
}

export interface ParameterConfig {
  name: string
  type: 'path' | 'query' | 'body' | 'header'
  required?: boolean
  default?: unknown
  description?: string
  schema?: {
    type?: string
    format?: string
    enum?: string[]
    minimum?: number
    maximum?: number
  }
}

export interface AliasConfig {
  name: string
  endpoint: string
  args: Record<string, unknown>
  description?: string
  hidden?: boolean
}

export interface TransformConfig {
  fields?: string[]
  rename?: Record<string, string>
}

export interface ApiResponse {
  success: boolean
  data?: unknown
  error?: ApiError
  metadata?: {
    timestamp: number
    duration?: number
    cached?: boolean
    transformed?: boolean
    statusCode?: number
  }
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface RequestContext {
  service: ServiceConfig
  endpoint: EndpointConfig
  args: Record<string, unknown>
  options?: RequestOptions
  headers?: Record<string, string>
}

export interface RequestOptions {
  json?: boolean
  debug?: boolean
  noCache?: boolean
  noTransform?: boolean
  timeout?: number
  testMode?: boolean
}

export interface CacheEntry {
  key: string
  data: unknown
  timestamp: number
  ttl: number
  metadata?: {
    service?: string
    endpoint?: string
    url?: string
  }
  size?: number
}

export interface CacheStats {
  totalEntries: number
  totalSize: number
  oldestEntry?: Date
  newestEntry?: Date
}

export * from './error'
