import {
  mapParameters,
  parseCliArgs,
  mergeWithAlias,
} from '../../src/api/params'
import type { EndpointConfig } from '../../src/types/config'
import { OvrmndError, ErrorCode } from '../../src/utils/error'

describe('Parameter Mapping', () => {
  describe('mapParameters', () => {
    it('should map path parameters', () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{userId}/posts/{postId}',
      }

      const rawParams = {
        userId: '123',
        postId: '456',
        include: 'comments',
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.path).toEqual({
        userId: '123',
        postId: '456',
      })
      expect(result.query).toEqual({
        include: 'comments',
      })
    })

    it('should throw error for missing path parameters', () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{userId}',
      }

      const rawParams = {
        include: 'posts',
      }

      expect(() => mapParameters(endpoint, rawParams)).toThrow(
        OvrmndError,
      )

      try {
        mapParameters(endpoint, rawParams)
      } catch (error) {
        expect((error as OvrmndError).code).toBe(
          ErrorCode.PARAM_REQUIRED,
        )
        expect((error as OvrmndError).message).toContain('userId')
      }
    })

    it('should map query parameters for GET requests', () => {
      const endpoint: EndpointConfig = {
        name: 'listUsers',
        method: 'GET',
        path: '/users',
      }

      const rawParams = {
        limit: 10,
        offset: 20,
        tags: ['admin', 'active'],
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.query).toEqual({
        limit: '10',
        offset: '20',
        tags: ['admin', 'active'],
      })
      expect(result.body).toBeUndefined()
    })

    it('should map body parameters for POST requests', () => {
      const endpoint: EndpointConfig = {
        name: 'createUser',
        method: 'POST',
        path: '/users',
      }

      const rawParams = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      })
      expect(result.query).toEqual({})
    })

    it('should use parameter hints', () => {
      const endpoint: EndpointConfig = {
        name: 'searchUsers',
        method: 'GET',
        path: '/users/search',
      }

      const rawParams = {
        'X-Request-ID': 'abc123',
        query: 'john',
        limit: 10,
      }

      const hints = {
        headerParams: ['X-Request-ID'],
        queryParams: ['query', 'limit'],
      }

      const result = mapParameters(endpoint, rawParams, hints)

      expect(result.headers).toEqual({
        'X-Request-ID': 'abc123',
      })
      expect(result.query).toEqual({
        query: 'john',
        limit: '10',
      })
    })

    it('should apply default parameters', () => {
      const endpoint: EndpointConfig = {
        name: 'listUsers',
        method: 'GET',
        path: '/users',
        defaultParams: {
          limit: 20,
          sort: 'created_at',
        },
      }

      const rawParams = {
        offset: 10,
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.query).toEqual({
        offset: '10',
        limit: '20',
        sort: 'created_at',
      })
    })

    it('should not override provided params with defaults', () => {
      const endpoint: EndpointConfig = {
        name: 'listUsers',
        method: 'GET',
        path: '/users',
        defaultParams: {
          limit: 20,
        },
      }

      const rawParams = {
        limit: 50,
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.query).toEqual({
        limit: '50',
      })
    })

    it('should skip internal parameters', () => {
      const endpoint: EndpointConfig = {
        name: 'test',
        method: 'GET',
        path: '/test',
      }

      const rawParams = {
        _internal: 'value',
        $0: 'command',
        valid: 'param',
      }

      const result = mapParameters(endpoint, rawParams)

      expect(result.query).toEqual({
        valid: 'param',
      })
    })
  })

  describe('parseCliArgs', () => {
    it('should parse flag with value', () => {
      const args = ['--name', 'John', '--age', '30']
      const result = parseCliArgs(args)

      expect(result).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should parse boolean flags', () => {
      const args = ['--verbose', '--debug', 'true']
      const result = parseCliArgs(args)

      expect(result).toEqual({
        verbose: true,
        debug: 'true',
      })
    })

    it('should parse array values', () => {
      const args = ['--tag', 'v1', '--tag', 'v2', '--tag', 'v3']
      const result = parseCliArgs(args)

      expect(result).toEqual({
        tag: ['v1', 'v2', 'v3'],
      })
    })

    it('should parse positional arguments', () => {
      const args = ['create', 'user', '--name', 'John']
      const result = parseCliArgs(args)

      expect(result).toEqual({
        _: ['create', 'user'],
        name: 'John',
      })
    })

    it('should parse numeric values', () => {
      const args = [
        '--limit',
        '100',
        '--offset',
        '0',
        '--ratio',
        '0.5',
      ]
      const result = parseCliArgs(args)

      expect(result).toEqual({
        limit: 100,
        offset: 0,
        ratio: 0.5,
      })
    })

    it('should handle empty args', () => {
      const result = parseCliArgs([])
      expect(result).toEqual({})
    })

    it('should handle trailing flag', () => {
      const args = ['--name', 'John', '--verbose']
      const result = parseCliArgs(args)

      expect(result).toEqual({
        name: 'John',
        verbose: true,
      })
    })
  })

  describe('mergeWithAlias', () => {
    it('should merge with CLI params taking precedence', () => {
      const aliasArgs = {
        userId: '123',
        include: 'posts',
        limit: 10,
      }

      const cliParams = {
        include: 'comments',
        offset: 20,
      }

      const result = mergeWithAlias(aliasArgs, cliParams)

      expect(result).toEqual({
        userId: '123',
        include: 'comments', // CLI override
        limit: 10,
        offset: 20,
      })
    })

    it('should handle empty CLI params', () => {
      const aliasArgs = {
        userId: '123',
        include: 'posts',
      }

      const result = mergeWithAlias(aliasArgs, {})

      expect(result).toEqual(aliasArgs)
    })

    it('should handle empty alias args', () => {
      const cliParams = {
        userId: '456',
        include: 'comments',
      }

      const result = mergeWithAlias({}, cliParams)

      expect(result).toEqual(cliParams)
    })
  })
})
