import { z } from 'zod'
import type { GraphQLOperationConfig } from '../types/graphql.js'
import { TransformConfigSchema } from './validator.js'

/**
 * GraphQL operation type schema
 */
const graphQLOperationTypeSchema = z.enum(['query', 'mutation'])

/**
 * GraphQL operation configuration schema
 */
export const graphQLOperationConfigSchema = z.object({
  name: z.string().min(1, 'Operation name is required'),
  operationType: graphQLOperationTypeSchema.optional(),
  query: z.string().min(1, 'GraphQL query is required'),
  variables: z.record(z.unknown()).optional(),
  cacheTTL: z
    .number()
    .positive('Cache TTL must be positive')
    .optional(),
  transform: z
    .union([TransformConfigSchema, z.array(TransformConfigSchema)])
    .optional(),
})

/**
 * Validate a GraphQL operation configuration
 */
export function validateGraphQLOperation(operation: unknown): {
  valid: boolean
  errors?: string[]
} {
  const result = graphQLOperationConfigSchema.safeParse(operation)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`,
      ),
    }
  }

  return { valid: true }
}

/**
 * Validate GraphQL-specific configuration rules
 */
export function validateGraphQLRules(
  operations: GraphQLOperationConfig[],
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  // Check for duplicate operation names
  const operationNames = new Set<string>()
  for (const op of operations) {
    if (operationNames.has(op.name)) {
      errors.push(`Duplicate GraphQL operation name: ${op.name}`)
    }
    operationNames.add(op.name)
  }

  // Validate each operation
  for (const op of operations) {
    // Check if mutations have cacheTTL (they shouldn't)
    if (op.operationType === 'mutation' && op.cacheTTL) {
      warnings.push(
        `GraphQL mutation "${op.name}" has cacheTTL - mutations should not be cached`,
      )
    }

    // Basic query syntax validation
    const query = op.query.trim()

    // Check if query starts with query/mutation keyword
    if (!query.match(/^(?:query|mutation)\s/)) {
      // It's valid to omit the operation type for queries
      if (op.operationType === 'mutation') {
        errors.push(
          `GraphQL mutation "${op.name}" should start with "mutation" keyword`,
        )
      }
    }

    // Check for basic GraphQL syntax
    if (!query.includes('{')) {
      errors.push(
        `GraphQL operation "${op.name}" appears to be missing opening brace`,
      )
    }

    // Check if variables in query match variables object
    const variableMatches = query.matchAll(/\$(\w+):\s*\w+/g)
    const declaredVars = new Set(
      Array.from(variableMatches).map(m => m[1]),
    )

    if (op.variables) {
      for (const varName of Object.keys(op.variables)) {
        if (!declaredVars.has(varName)) {
          warnings.push(
            `GraphQL operation "${op.name}" has default value for undeclared variable: $${varName}`,
          )
        }
      }
    }
  }

  return { warnings, errors }
}

/**
 * Extract operation type from query string
 */
export function extractOperationType(
  query: string,
): 'query' | 'mutation' | undefined {
  const match = query.trim().match(/^(query|mutation)\s/)
  return match ? (match[1] as 'query' | 'mutation') : undefined
}
