import { z } from 'zod'
import type { ServiceConfig } from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import { graphQLOperationConfigSchema } from './graphql-validator'

/**
 * Zod schema for HTTP methods
 */
const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
])

/**
 * Zod schema for API types
 */
const ApiTypeSchema = z.enum(['rest', 'graphql'])

/**
 * Zod schema for authentication types
 */
const AuthTypeSchema = z.enum(['bearer', 'apikey'])

/**
 * Zod schema for authentication configuration
 */
const AuthConfigSchema = z.object({
  type: AuthTypeSchema,
  token: z.string().min(1, 'Token cannot be empty'),
  header: z.string().optional(),
})

/**
 * Zod schema for transform configuration
 */
export const TransformConfigSchema = z.object({
  fields: z.array(z.string()).optional(),
  rename: z.record(z.string()).optional(),
})

/**
 * Zod schema for endpoint configuration
 */
const EndpointConfigSchema = z.object({
  name: z.string().min(1, 'Endpoint name cannot be empty'),
  method: HttpMethodSchema,
  path: z.string().min(1, 'Path cannot be empty'),
  cacheTTL: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
  defaultParams: z.record(z.unknown()).optional(),
  transform: z
    .union([TransformConfigSchema, z.array(TransformConfigSchema)])
    .optional(),
})

/**
 * Zod schema for alias configuration
 */
const AliasConfigSchema = z.object({
  name: z.string().min(1, 'Alias name cannot be empty'),
  endpoint: z.string().min(1, 'Endpoint reference cannot be empty'),
  args: z.record(z.unknown()).optional(),
})

/**
 * Zod schema for service configuration
 */
const ServiceConfigSchema = z
  .object({
    serviceName: z.string().min(1, 'Service name cannot be empty'),
    baseUrl: z
      .string()
      .url('Base URL must be a valid URL')
      .or(
        z
          .string()
          .regex(
            /^\$\{[^}]+\}$/,
            'Base URL must be a valid URL or environment variable',
          ),
      ),
    apiType: ApiTypeSchema.optional(),
    authentication: AuthConfigSchema.optional(),
    endpoints: z.array(EndpointConfigSchema).optional(),
    graphqlEndpoint: z.string().optional(),
    graphqlOperations: z
      .array(graphQLOperationConfigSchema)
      .optional(),
    aliases: z.array(AliasConfigSchema).optional(),
  })
  .refine(
    data => {
      // Check that either endpoints or graphqlOperations are provided
      const isRest = !data.apiType || data.apiType === 'rest'
      const isGraphQL = data.apiType === 'graphql'

      if (
        isRest &&
        (!data.endpoints || data.endpoints.length === 0)
      ) {
        return false
      }
      if (
        isGraphQL &&
        (!data.graphqlOperations ||
          data.graphqlOperations.length === 0)
      ) {
        return false
      }
      return true
    },
    {
      message:
        'REST services require endpoints, GraphQL services require graphqlOperations',
    },
  )
  .refine(
    data => {
      // Check for GraphQL endpoint when using GraphQL
      if (data.apiType === 'graphql' && !data.graphqlEndpoint) {
        return false
      }
      return true
    },
    {
      message: 'GraphQL services require graphqlEndpoint',
    },
  )
  .refine(
    data => {
      // Check for duplicate endpoint names
      if (data.endpoints) {
        const endpointNames = data.endpoints.map(e => e.name)
        const uniqueNames = new Set(endpointNames)
        return endpointNames.length === uniqueNames.size
      }
      return true
    },
    {
      message: 'Duplicate endpoint names found',
    },
  )
  .refine(
    data => {
      // Check for duplicate GraphQL operation names
      if (data.graphqlOperations) {
        const operationNames = data.graphqlOperations.map(
          op => op.name,
        )
        const uniqueNames = new Set(operationNames)
        return operationNames.length === uniqueNames.size
      }
      return true
    },
    {
      message: 'Duplicate GraphQL operation names found',
    },
  )
  .refine(
    data => {
      // Check for duplicate alias names
      if (data.aliases) {
        const aliasNames = data.aliases.map(a => a.name)
        const uniqueNames = new Set(aliasNames)
        return aliasNames.length === uniqueNames.size
      }
      return true
    },
    {
      message: 'Duplicate alias names found',
    },
  )
  .refine(
    data => {
      // Check that all alias endpoints exist
      if (data.aliases) {
        const endpointNames = new Set([
          ...(data.endpoints?.map(e => e.name) ?? []),
          ...(data.graphqlOperations?.map(op => op.name) ?? []),
        ])
        return data.aliases.every(alias =>
          endpointNames.has(alias.endpoint),
        )
      }
      return true
    },
    {
      message: 'Alias references non-existent endpoint or operation',
    },
  )

/**
 * Validate a service configuration
 */
export function validateServiceConfig(
  config: unknown,
  filePath: string,
): ServiceConfig {
  try {
    return ServiceConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors
        .map(e => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')
      throw new OvrmndError({
        code: ErrorCode.CONFIG_VALIDATION_ERROR,
        message: `Invalid configuration in ${filePath}:\n${issues}`,
      })
    }
    throw error
  }
}

/**
 * Validate path parameters match between path and args
 */
export function validatePathParameters(
  path: string,
  args: Record<string, unknown>,
): string[] {
  const pathParams = extractPathParameters(path)
  const missingParams: string[] = []

  for (const param of pathParams) {
    if (!(param in args)) {
      missingParams.push(param)
    }
  }

  return missingParams
}

/**
 * Extract parameter names from a path template
 */
export function extractPathParameters(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g) ?? []
  return matches.map(match => match.slice(1, -1))
}

/**
 * Check if a value is a valid HTTP method
 */
export function isValidHttpMethod(method: string): boolean {
  try {
    HttpMethodSchema.parse(method)
    return true
  } catch {
    return false
  }
}
