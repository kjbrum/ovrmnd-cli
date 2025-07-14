import type { TransformConfig } from './config.js'

/**
 * GraphQL operation types
 */
export type GraphQLOperationType = 'query' | 'mutation'

/**
 * Configuration for a GraphQL operation (query or mutation)
 */
export interface GraphQLOperationConfig {
  /** Unique identifier for the operation */
  name: string

  /** Type of GraphQL operation */
  operationType?: GraphQLOperationType

  /** The GraphQL query or mutation string */
  query: string

  /** Default variables for the operation */
  variables?: Record<string, unknown>

  /** Cache TTL in seconds (only for queries) */
  cacheTTL?: number

  /** Response transformation configuration */
  transform?: TransformConfig | TransformConfig[]
}

/**
 * GraphQL request format
 */
export interface GraphQLRequest {
  /** The GraphQL query or mutation */
  query: string

  /** Variables for the operation */
  variables?: Record<string, unknown>

  /** Optional operation name (useful for batching) */
  operationName?: string
}

/**
 * Standard GraphQL response format
 */
export interface GraphQLResponse<T = unknown> {
  /** The data returned by the operation */
  data?: T

  /** Any errors that occurred */
  errors?: GraphQLError[]
}

/**
 * GraphQL error format
 */
export interface GraphQLError {
  /** Error message */
  message: string

  /** Location in the query where the error occurred */
  locations?: Array<{
    line: number
    column: number
  }>

  /** Path to the field that caused the error */
  path?: Array<string | number>

  /** Additional error information */
  extensions?: Record<string, unknown>
}

/**
 * GraphQL-specific HTTP error
 */
export class GraphQLHttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response: GraphQLResponse,
    public request: GraphQLRequest,
  ) {
    super(message)
    this.name = 'GraphQLHttpError'
  }
}
