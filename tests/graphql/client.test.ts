import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'
import {
  executeGraphQLOperation,
  buildGraphQLRequest,
  parseGraphQLErrors,
} from '../../src/api/graphql'
import { GraphQLHttpError } from '../../src/types/graphql'
import { OvrmndError } from '../../src/utils/error'
import type { ResolvedServiceConfig } from '../../src/types/config'
import type { GraphQLOperationConfig } from '../../src/types/graphql'

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('GraphQL Client', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const mockService: ResolvedServiceConfig = {
    serviceName: 'test-graphql',
    baseUrl: 'https://api.example.com',
    apiType: 'graphql',
    graphqlEndpoint: '/graphql',
    authentication: {
      type: 'bearer',
      token: 'test-token',
    },
  }

  const mockOperation: GraphQLOperationConfig = {
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
    cacheTTL: 300,
  }

  describe('executeGraphQLOperation', () => {
    it('should execute a successful GraphQL query', async () => {
      const mockResponse = {
        data: {
          user: {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const result = await executeGraphQLOperation(
        mockService,
        mockOperation,
        { id: '123' },
      )

      expect(result).toEqual(mockResponse.data)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining('"variables":{"id":"123"}'),
        }),
      )
    })

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            message: 'User not found',
            path: ['user'],
            locations: [{ line: 2, column: 3 }],
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      await expect(
        executeGraphQLOperation(mockService, mockOperation, {
          id: '999',
        }),
      ).rejects.toThrow(GraphQLHttpError)

      try {
        await executeGraphQLOperation(mockService, mockOperation, {
          id: '999',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLHttpError)
        if (error instanceof GraphQLHttpError) {
          expect(error.message).toBe('User not found')
          expect(error.response.errors).toEqual(mockResponse.errors)
        }
      }
    })

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({ message: 'Internal Server Error' }),
      } as Response)

      await expect(
        executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        }),
      ).rejects.toThrow(GraphQLHttpError)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        }),
      ).rejects.toThrow(OvrmndError)

      try {
        await executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(OvrmndError)
        if (error instanceof OvrmndError) {
          expect(error.message).toContain('GraphQL request failed')
        }
      }
    })

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          }),
      )

      await expect(
        executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        }),
      ).rejects.toThrow(OvrmndError)

      try {
        await executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(OvrmndError)
        if (error instanceof OvrmndError) {
          expect(error.message).toBe('GraphQL request timed out')
        }
      }
    })

    it('should throw error if service has no GraphQL endpoint', async () => {
      const serviceWithoutEndpoint: ResolvedServiceConfig = {
        ...mockService,
        graphqlEndpoint: undefined,
      }

      await expect(
        executeGraphQLOperation(
          serviceWithoutEndpoint,
          mockOperation,
          { id: '123' },
        ),
      ).rejects.toThrow(
        'Service does not have a GraphQL endpoint configured',
      )
    })

    it('should apply transformations if configured', async () => {
      const mockResponse = {
        data: {
          user: {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
            createdAt: '2023-01-01',
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const operationWithTransform: GraphQLOperationConfig = {
        ...mockOperation,
        transform: {
          fields: ['user.id', 'user.name'],
        },
      }

      const result = await executeGraphQLOperation(
        mockService,
        operationWithTransform,
        { id: '123' },
      )

      expect(result).toEqual({
        user: {
          id: '123',
          name: 'John Doe',
        },
      })
    })

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'Invalid JSON',
      } as Response)

      await expect(
        executeGraphQLOperation(mockService, mockOperation, {
          id: '123',
        }),
      ).rejects.toThrow('Invalid JSON response from GraphQL endpoint')
    })
  })

  describe('buildGraphQLRequest', () => {
    it('should build a request with variables', () => {
      const request = buildGraphQLRequest(mockOperation, {
        id: '123',
      })

      expect(request).toEqual({
        query: mockOperation.query,
        variables: { id: '123' },
        operationName: 'GetUser',
      })
    })

    it('should merge default variables with provided variables', () => {
      const operationWithDefaults: GraphQLOperationConfig = {
        ...mockOperation,
        variables: { limit: 10 },
      }

      const request = buildGraphQLRequest(operationWithDefaults, {
        id: '123',
      })

      expect(request.variables).toEqual({
        limit: 10,
        id: '123',
      })
    })

    it('should extract operation name from query', () => {
      const request = buildGraphQLRequest(mockOperation, {})

      expect(request.operationName).toBe('GetUser')
    })

    it('should handle queries without operation name', () => {
      const simpleOperation: GraphQLOperationConfig = {
        name: 'simple',
        query: '{ users { id } }',
      }

      const request = buildGraphQLRequest(simpleOperation, {})

      expect(request.operationName).toBeUndefined()
    })

    it('should handle empty variables', () => {
      const request = buildGraphQLRequest(mockOperation, {})

      expect(request.variables).toBeUndefined()
    })
  })

  describe('parseGraphQLErrors', () => {
    it('should parse GraphQL errors with all fields', () => {
      const errors = [
        {
          message: 'Field error',
          path: ['user', 'email'],
          locations: [{ line: 3, column: 5 }],
        },
      ]

      const parsed = parseGraphQLErrors(errors)

      expect(parsed).toEqual([
        'Field error at path: user.email (line 3, column 5)',
      ])
    })

    it('should handle errors without path or locations', () => {
      const errors = [{ message: 'General error' }]

      const parsed = parseGraphQLErrors(errors)

      expect(parsed).toEqual(['General error'])
    })

    it('should handle empty errors array', () => {
      const parsed = parseGraphQLErrors([])

      expect(parsed).toEqual([])
    })

    it('should handle undefined errors', () => {
      const parsed = parseGraphQLErrors(undefined)

      expect(parsed).toEqual([])
    })

    it('should handle multiple errors', () => {
      const errors = [
        { message: 'Error 1' },
        { message: 'Error 2', path: ['field'] },
        { message: 'Error 3', locations: [{ line: 1, column: 1 }] },
      ]

      const parsed = parseGraphQLErrors(errors)

      expect(parsed).toHaveLength(3)
      expect(parsed[0]).toBe('Error 1')
      expect(parsed[1]).toBe('Error 2 at path: field')
      expect(parsed[2]).toBe('Error 3 (line 1, column 1)')
    })
  })
})
