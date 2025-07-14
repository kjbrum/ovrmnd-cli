import { describe, it, expect } from '@jest/globals'
import {
  validateGraphQLOperation,
  validateGraphQLRules,
  extractOperationType,
} from '../../src/config/graphql-validator'
import type { GraphQLOperationConfig } from '../../src/types/graphql'

describe('GraphQL Validator', () => {
  describe('validateGraphQLOperation', () => {
    it('should validate a valid query operation', () => {
      const operation = {
        name: 'getUser',
        operationType: 'query',
        query: `
          query GetUser($id: ID!) {
            user(id: $id) {
              id
              name
              email
            }
          }
        `,
        variables: { id: '123' },
        cacheTTL: 300,
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should validate a valid mutation operation', () => {
      const operation = {
        name: 'createUser',
        operationType: 'mutation',
        query: `
          mutation CreateUser($input: CreateUserInput!) {
            createUser(input: $input) {
              id
              name
            }
          }
        `,
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject operation without name', () => {
      const operation = {
        query: 'query { users { id } }',
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('name: Required')
    })

    it('should reject operation without query', () => {
      const operation = {
        name: 'getUsers',
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('query: Required')
    })

    it('should reject invalid cacheTTL', () => {
      const operation = {
        name: 'getUsers',
        query: 'query { users { id } }',
        cacheTTL: -1,
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(false)
      expect(result.errors?.[0]).toContain(
        'Cache TTL must be positive',
      )
    })

    it('should accept operation with transform config', () => {
      const operation = {
        name: 'getUsers',
        query: 'query { users { id } }',
        transform: {
          fields: ['users'],
        },
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(true)
    })

    it('should accept operation with transform pipeline', () => {
      const operation = {
        name: 'getUsers',
        query: 'query { users { id } }',
        transform: [
          { fields: ['users'] },
          { rename: { users: 'people' } },
        ],
      }

      const result = validateGraphQLOperation(operation)
      expect(result.valid).toBe(true)
    })
  })

  describe('validateGraphQLRules', () => {
    it('should detect duplicate operation names', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'getUser',
          query: 'query { user { id } }',
        },
        {
          name: 'getUser',
          query: 'query { user { name } }',
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.errors).toContain(
        'Duplicate GraphQL operation name: getUser',
      )
    })

    it('should warn about cacheTTL on mutations', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'createUser',
          operationType: 'mutation',
          query: 'mutation { createUser { id } }',
          cacheTTL: 300,
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.warnings).toContain(
        'GraphQL mutation "createUser" has cacheTTL - mutations should not be cached',
      )
    })

    it('should error if mutation does not start with mutation keyword', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'createUser',
          operationType: 'mutation',
          query: '{ createUser { id } }',
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.errors).toContain(
        'GraphQL mutation "createUser" should start with "mutation" keyword',
      )
    })

    it('should error if query is missing opening brace', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'getUser',
          query: 'query GetUser',
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.errors).toContain(
        'GraphQL operation "getUser" appears to be missing opening brace',
      )
    })

    it('should warn about undeclared variables in defaults', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'getUser',
          query: `
            query GetUser($id: ID!) {
              user(id: $id) { name }
            }
          `,
          variables: {
            id: '123',
            extra: 'value', // Not declared in query
          },
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.warnings).toContain(
        'GraphQL operation "getUser" has default value for undeclared variable: $extra',
      )
    })

    it('should accept valid operations without warnings or errors', () => {
      const operations: GraphQLOperationConfig[] = [
        {
          name: 'getUser',
          operationType: 'query',
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
                name
              }
            }
          `,
          variables: { id: '123' },
          cacheTTL: 300,
        },
        {
          name: 'createUser',
          operationType: 'mutation',
          query: `
            mutation CreateUser($input: CreateUserInput!) {
              createUser(input: $input) {
                id
              }
            }
          `,
        },
      ]

      const result = validateGraphQLRules(operations)
      expect(result.warnings).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('extractOperationType', () => {
    it('should extract query type', () => {
      const query = 'query GetUser { user { id } }'
      expect(extractOperationType(query)).toBe('query')
    })

    it('should extract mutation type', () => {
      const query = 'mutation CreateUser { createUser { id } }'
      expect(extractOperationType(query)).toBe('mutation')
    })

    it('should return undefined for implicit query', () => {
      const query = '{ user { id } }'
      expect(extractOperationType(query)).toBeUndefined()
    })

    it('should handle whitespace', () => {
      const query = '  \n  query   GetUser { user { id } }'
      expect(extractOperationType(query)).toBe('query')
    })
  })
})
