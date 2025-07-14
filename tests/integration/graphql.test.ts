import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals'
import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('GraphQL Integration', () => {
  let testDir: string

  beforeAll(() => {
    // Create a temporary directory for test configs
    testDir = join(tmpdir(), `ovrmnd-graphql-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, '.ovrmnd'), { recursive: true })
  })

  afterAll(() => {
    // Clean up
    rmSync(testDir, { recursive: true, force: true })
  })

  function runCLI(
    args: string[],
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise(resolve => {
      const proc = spawn(
        'node',
        [join(__dirname, '../../dist/cli.js'), ...args],
        {
          cwd: testDir,
          env: { ...process.env, DEBUG: 'false' },
        },
      )

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', data => {
        stdout += data.toString()
      })

      proc.stderr.on('data', data => {
        stderr += data.toString()
      })

      proc.on('close', code => {
        resolve({ stdout, stderr, code: code ?? 0 })
      })
    })
  }

  describe('GraphQL Service Configuration', () => {
    it('should handle GraphQL service configuration', async () => {
      const config = {
        serviceName: 'github-graphql',
        baseUrl: 'https://api.github.com',
        apiType: 'graphql',
        graphqlEndpoint: '/graphql',
        authentication: {
          type: 'bearer',
          token: '${GITHUB_TOKEN}',
        },
        graphqlOperations: [
          {
            name: 'getRepository',
            operationType: 'query',
            query: `
              query GetRepository($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                  id
                  name
                  description
                  stargazerCount
                }
              }
            `,
            cacheTTL: 300,
          },
          {
            name: 'createIssue',
            operationType: 'mutation',
            query: `
              mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
                createIssue(input: {
                  repositoryId: $repositoryId,
                  title: $title,
                  body: $body
                }) {
                  issue {
                    id
                    number
                    title
                  }
                }
              }
            `,
          },
        ],
        aliases: [
          {
            name: 'myRepo',
            endpoint: 'getRepository',
            args: {
              owner: 'octocat',
              name: 'Hello-World',
            },
          },
        ],
      }

      writeFileSync(
        join(testDir, '.ovrmnd', 'github-graphql.yaml'),
        `# GitHub GraphQL API Configuration
serviceName: ${config.serviceName}
baseUrl: ${config.baseUrl}
apiType: ${config.apiType}
graphqlEndpoint: ${config.graphqlEndpoint}

authentication:
  type: ${config.authentication.type}
  token: ${config.authentication.token}

graphqlOperations:
  - name: ${config.graphqlOperations[0].name}
    operationType: ${config.graphqlOperations[0].operationType}
    query: |
${config.graphqlOperations[0].query
  .split('\n')
  .map(line => '      ' + line)
  .join('\n')}
    cacheTTL: ${config.graphqlOperations[0].cacheTTL}

  - name: ${config.graphqlOperations[1].name}
    operationType: ${config.graphqlOperations[1].operationType}
    query: |
${config.graphqlOperations[1].query
  .split('\n')
  .map(line => '      ' + line)
  .join('\n')}

aliases:
  - name: ${config.aliases[0].name}
    endpoint: ${config.aliases[0].endpoint}
    args:
      owner: ${config.aliases[0].args.owner}
      name: ${config.aliases[0].args.name}
`,
      )

      // Test listing GraphQL operations
      const listResult = await runCLI([
        'list',
        'endpoints',
        'github-graphql',
      ])
      expect(listResult.code).toBe(0)
      expect(listResult.stderr).toContain('GraphQL Operations')
      expect(listResult.stderr).toContain('getRepository')
      expect(listResult.stderr).toContain('createIssue')
      expect(listResult.stderr).toContain('query')
      expect(listResult.stderr).toContain('mutation')
    })

    it('should validate GraphQL configuration', async () => {
      const invalidConfig = {
        serviceName: 'invalid-graphql',
        baseUrl: 'https://api.example.com',
        apiType: 'graphql',
        // Missing graphqlEndpoint
        graphqlOperations: [
          {
            name: 'badQuery',
            // Missing query
          },
        ],
      }

      writeFileSync(
        join(testDir, '.ovrmnd', 'invalid-graphql.yaml'),
        `serviceName: ${invalidConfig.serviceName}
baseUrl: ${invalidConfig.baseUrl}
apiType: ${invalidConfig.apiType}

graphqlOperations:
  - name: ${invalidConfig.graphqlOperations[0].name}
`,
      )

      const result = await runCLI(['validate'])
      expect(result.code).toBe(1)
      expect(result.stderr).toContain(
        'GraphQL services require graphqlEndpoint',
      )
    })

    it('should handle mixed REST and GraphQL services', async () => {
      // GraphQL service
      writeFileSync(
        join(testDir, '.ovrmnd', 'graphql-api.yaml'),
        `serviceName: graphql-api
baseUrl: https://api.example.com
apiType: graphql
graphqlEndpoint: /graphql

graphqlOperations:
  - name: getUsers
    query: |
      query GetUsers {
        users {
          id
          name
        }
      }
`,
      )

      // REST service
      writeFileSync(
        join(testDir, '.ovrmnd', 'rest-api.yaml'),
        `serviceName: rest-api
baseUrl: https://api.example.com

endpoints:
  - name: getUsers
    method: GET
    path: /users
`,
      )

      const listResult = await runCLI(['list', 'services'])
      expect(listResult.code).toBe(0)
      expect(listResult.stdout).toContain('graphql-api')
      expect(listResult.stdout).toContain('rest-api')

      // List GraphQL operations
      const graphqlList = await runCLI([
        'list',
        'endpoints',
        'graphql-api',
      ])
      expect(graphqlList.code).toBe(0)
      expect(graphqlList.stderr).toContain('GraphQL Operations')

      // List REST endpoints
      const restList = await runCLI(['list', 'endpoints', 'rest-api'])
      expect(restList.code).toBe(0)
      expect(restList.stderr).toContain('Endpoints for service')
    })
  })

  describe('GraphQL Validation Rules', () => {
    it('should validate GraphQL operation syntax', async () => {
      writeFileSync(
        join(testDir, '.ovrmnd', 'syntax-test.yaml'),
        `serviceName: syntax-test
baseUrl: https://api.example.com
apiType: graphql
graphqlEndpoint: /graphql

graphqlOperations:
  - name: missingBrace
    query: |
      query GetUser
      
  - name: duplicateName
    query: |
      query { users { id } }
      
  - name: duplicateName
    query: |
      query { users { name } }
`,
      )

      const result = await runCLI(['validate', '--strict'])
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('missing opening brace')
      expect(result.stderr).toContain(
        'Duplicate GraphQL operation names',
      )
    })

    it('should warn about mutations with cacheTTL', async () => {
      writeFileSync(
        join(testDir, '.ovrmnd', 'mutation-cache.yaml'),
        `serviceName: mutation-cache
baseUrl: https://api.example.com
apiType: graphql
graphqlEndpoint: /graphql

graphqlOperations:
  - name: createUser
    operationType: mutation
    query: |
      mutation CreateUser($name: String!) {
        createUser(name: $name) {
          id
        }
      }
    cacheTTL: 300
`,
      )

      const result = await runCLI(['validate'])
      expect(result.code).toBe(0)
      expect(result.stderr).toContain(
        'mutations should not be cached',
      )
    })
  })

  describe('GraphQL Transforms', () => {
    it('should support transforms on GraphQL responses', async () => {
      writeFileSync(
        join(testDir, '.ovrmnd', 'transform-test.yaml'),
        `serviceName: transform-test
baseUrl: https://api.example.com
apiType: graphql
graphqlEndpoint: /graphql

graphqlOperations:
  - name: getUsers
    query: |
      query GetUsers {
        users {
          id
          name
          email
          metadata {
            createdAt
            updatedAt
          }
        }
      }
    transform:
      - fields: ["users"]
      - rename:
          users: people
`,
      )

      const result = await runCLI(['validate'])
      expect(result.code).toBe(0)
    })
  })

  describe('GraphQL Batch Operations', () => {
    it('should validate batch operation configuration', async () => {
      writeFileSync(
        join(testDir, '.ovrmnd', 'batch-test.yaml'),
        `serviceName: batch-test
baseUrl: https://api.example.com
apiType: graphql
graphqlEndpoint: /graphql

graphqlOperations:
  - name: getUser
    query: |
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
        }
      }
`,
      )

      // This would test the batch functionality if we had a running GraphQL server
      // For now, just validate the configuration works
      const result = await runCLI(['validate'])
      expect(result.code).toBe(0)
    })
  })
})
