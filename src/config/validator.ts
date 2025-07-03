import { z } from 'zod'
import type { ServiceConfig } from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'

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
 * Zod schema for endpoint configuration
 */
const EndpointConfigSchema = z.object({
  name: z.string().min(1, 'Endpoint name cannot be empty'),
  method: HttpMethodSchema,
  path: z.string().min(1, 'Path cannot be empty'),
  cacheTTL: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
  defaultParams: z.record(z.unknown()).optional(),
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
    authentication: AuthConfigSchema.optional(),
    endpoints: z
      .array(EndpointConfigSchema)
      .min(1, 'At least one endpoint is required'),
    aliases: z.array(AliasConfigSchema).optional(),
  })
  .refine(
    data => {
      // Check for duplicate endpoint names
      const endpointNames = data.endpoints.map(e => e.name)
      const uniqueNames = new Set(endpointNames)
      return endpointNames.length === uniqueNames.size
    },
    {
      message: 'Duplicate endpoint names found',
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
        const endpointNames = new Set(data.endpoints.map(e => e.name))
        return data.aliases.every(alias =>
          endpointNames.has(alias.endpoint),
        )
      }
      return true
    },
    {
      message: 'Alias references non-existent endpoint',
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
