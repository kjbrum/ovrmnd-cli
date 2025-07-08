import { TransformPipeline } from '../../src/transform/pipeline'
import type {
  TransformConfig,
  EndpointConfig,
} from '../../src/types/config'
import { DebugFormatter } from '../../src/utils/debug'

describe('TransformPipeline', () => {
  describe('pipeline execution', () => {
    it('should execute multiple transformations in sequence', () => {
      const configs: TransformConfig[] = [
        {
          // First: extract fields
          fields: ['id', 'user.name', 'items'],
        },
        {
          // Second: rename fields
          rename: {
            'user.name': 'userName',
          },
        },
      ]

      const pipeline = new TransformPipeline(configs)

      const input = {
        id: 1,
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        items: ['item1', 'item2'],
        metadata: { version: 1 },
      }

      const result = pipeline.transform(input)

      expect(result).toEqual({
        id: 1,
        user: {},
        userName: 'John Doe',
        items: ['item1', 'item2'],
      })
    })

    it('should handle empty pipeline', () => {
      const pipeline = new TransformPipeline([])

      const input = { id: 1, name: 'Test' }
      const result = pipeline.transform(input)

      expect(result).toBe(input)
    })

    it('should continue on transformation errors', () => {
      const configs: TransformConfig[] = [
        {
          fields: ['id', 'name'],
        },
        {
          // This might cause an error if name was removed
          rename: {
            missing_field: 'newField',
          },
        },
        {
          fields: ['id'],
        },
      ]

      const pipeline = new TransformPipeline(configs)

      const input = { id: 1, name: 'Test', extra: 'data' }
      const result = pipeline.transform(input)

      // Should still apply successful transformations
      expect(result).toEqual({
        id: 1,
      })
    })
  })

  describe('fromEndpoint', () => {
    it('should create pipeline from endpoint with single transform', () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        transform: {
          fields: ['id', 'name'],
        },
      }

      const pipeline = TransformPipeline.fromEndpoint(endpoint)

      expect(pipeline).not.toBeNull()

      const input = { id: 1, name: 'Test', email: 'test@example.com' }
      const result = pipeline!.transform(input)

      expect(result).toEqual({
        id: 1,
        name: 'Test',
      })
    })

    it('should create pipeline from endpoint with array of transforms', () => {
      const endpoint: EndpointConfig = {
        name: 'getUsers',
        method: 'GET',
        path: '/users',
        transform: [
          {
            fields: ['users[*].id', 'users[*].name'],
          },
          {
            rename: {
              users: 'data',
            },
          },
        ],
      }

      const pipeline = TransformPipeline.fromEndpoint(endpoint)

      expect(pipeline).not.toBeNull()

      const input = {
        users: [
          { id: 1, name: 'User 1', email: 'user1@example.com' },
          { id: 2, name: 'User 2', email: 'user2@example.com' },
        ],
        meta: { total: 2 },
      }

      const result = pipeline!.transform(input)

      expect(result).toEqual({
        data: [1, 2],
      })
    })

    it('should return null for endpoint without transform', () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
      }

      const pipeline = TransformPipeline.fromEndpoint(endpoint)

      expect(pipeline).toBeNull()
    })
  })

  describe('debug output', () => {
    it('should log transformation metrics with debug formatter', () => {
      const debugFormatter = new DebugFormatter(true)
      const logSpy = jest.spyOn(debugFormatter, 'log')

      const configs: TransformConfig[] = [
        {
          fields: ['id', 'name'],
        },
      ]

      const pipeline = new TransformPipeline(configs)

      const input = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        profile: {
          bio: 'A long bio text here...',
        },
      }

      pipeline.transform(input, debugFormatter)

      expect(logSpy).toHaveBeenCalledWith(
        'TRANSFORM',
        expect.objectContaining({
          step: 1,
          duration: expect.stringMatching(/\d+ms/),
          inputSize: expect.stringMatching(/\d+ bytes/),
          outputSize: expect.stringMatching(/\d+ bytes/),
          reduction: expect.stringMatching(/\d+%/),
        }),
      )
    })
  })
})
