import { parseYaml } from '../../src/config/yaml-parser'
import { OvrmndError } from '../../src/utils/error'

describe('YAML Parser', () => {
  describe('parseYaml', () => {
    it('should parse valid YAML configuration', () => {
      const yamlContent = `
serviceName: github
baseUrl: https://api.github.com
authentication:
  type: bearer
  token: \${GITHUB_TOKEN}
endpoints:
  - name: getUser
    method: GET
    path: /users/{username}
  - name: listRepos
    method: GET
    path: /users/{username}/repos
    cacheTTL: 300
aliases:
  - name: myRepos
    endpoint: listRepos
    args:
      username: octocat
`

      const config = parseYaml(yamlContent, 'test.yaml')

      expect(config.serviceName).toBe('github')
      expect(config.baseUrl).toBe('https://api.github.com')
      expect(config.authentication?.type).toBe('bearer')
      expect(config.authentication?.token).toBe('${GITHUB_TOKEN}')
      expect(config.endpoints).toHaveLength(2)
      expect(config.aliases).toHaveLength(1)
    })

    it('should throw error for invalid YAML syntax', () => {
      const invalidYaml = `
serviceName: github
baseUrl: https://api.github.com
  invalid indentation here
`

      expect(() => parseYaml(invalidYaml, 'test.yaml')).toThrow(
        OvrmndError,
      )
    })

    it('should throw error for missing required fields', () => {
      const incompleteYaml = `
serviceName: github
# missing baseUrl and endpoints
`

      expect(() => parseYaml(incompleteYaml, 'test.yaml')).toThrow(
        OvrmndError,
      )
    })

    it('should throw error for invalid endpoint method', () => {
      const invalidMethodYaml = `
serviceName: github
baseUrl: https://api.github.com
endpoints:
  - name: getUser
    method: INVALID
    path: /users/{username}
`

      expect(() => parseYaml(invalidMethodYaml, 'test.yaml')).toThrow(
        OvrmndError,
      )
    })

    it('should throw error for duplicate endpoint names', () => {
      const duplicateEndpointsYaml = `
serviceName: github
baseUrl: https://api.github.com
endpoints:
  - name: getUser
    method: GET
    path: /users/{username}
  - name: getUser
    method: GET
    path: /users/{id}
`

      expect(() =>
        parseYaml(duplicateEndpointsYaml, 'test.yaml'),
      ).toThrow(OvrmndError)
    })

    it('should throw error for alias referencing non-existent endpoint', () => {
      const invalidAliasYaml = `
serviceName: github
baseUrl: https://api.github.com
endpoints:
  - name: getUser
    method: GET
    path: /users/{username}
aliases:
  - name: myAlias
    endpoint: nonExistentEndpoint
    args:
      username: test
`

      expect(() => parseYaml(invalidAliasYaml, 'test.yaml')).toThrow(
        OvrmndError,
      )
    })

    it('should accept API key authentication', () => {
      const apiKeyYaml = `
serviceName: api
baseUrl: https://api.example.com
authentication:
  type: apikey
  token: \${API_KEY}
  header: X-Custom-Key
endpoints:
  - name: getData
    method: GET
    path: /data
`

      const config = parseYaml(apiKeyYaml, 'test.yaml')

      expect(config.authentication?.type).toBe('apikey')
      expect(config.authentication?.header).toBe('X-Custom-Key')
    })

    it('should parse endpoints with headers and defaultParams', () => {
      const complexEndpointYaml = `
serviceName: api
baseUrl: https://api.example.com
endpoints:
  - name: getData
    method: POST
    path: /data
    headers:
      Content-Type: application/json
      X-Custom-Header: value
    defaultParams:
      limit: 10
      offset: 0
`

      const config = parseYaml(complexEndpointYaml, 'test.yaml')
      const endpoint = config.endpoints[0]

      expect(endpoint?.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
      })
      expect(endpoint?.defaultParams).toEqual({
        limit: 10,
        offset: 0,
      })
    })
  })
})
