import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

describe('List Command Integration', () => {
  let tempDir: string
  let configDir: string

  beforeEach(async () => {
    // Create temp directory for test configs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ovrmnd-test-'))
    configDir = path.join(tempDir, '.ovrmnd')
    await fs.mkdir(configDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  const runCommand = async (command: string) => {
    const fullCommand = `node dist/cli.js ${command} --config ${configDir}`
    try {
      const { stdout, stderr } = await execAsync(fullCommand)
      return { stdout, stderr, code: 0 }
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.code || 1,
      }
    }
  }

  describe('list services', () => {
    it('should show no services when config is empty', async () => {
      const { stderr } = await runCommand('list services --pretty')

      expect(stderr).toContain('No services configured')
      expect(stderr).toContain('To add a service')
      expect(stderr).toContain('~/.ovrmnd/')
      expect(stderr).toContain('./.ovrmnd/')
    })

    it('should list services in JSON mode', async () => {
      // Create test config
      const githubConfig = `
serviceName: github
baseUrl: https://api.github.com
authentication:
  type: bearer
  token: \${GITHUB_TOKEN}
endpoints:
  - name: listRepos
    method: GET
    path: /users/{username}/repos
  - name: getRepo
    method: GET
    path: /repos/{owner}/{repo}
`
      await fs.writeFile(
        path.join(configDir, 'github.yaml'),
        githubConfig,
      )

      const { stdout } = await runCommand('list services')

      const result = JSON.parse(stdout)
      expect(result.services).toHaveLength(1)
      expect(result.services[0]).toMatchObject({
        name: 'github',
        baseUrl: 'https://api.github.com',
        authentication: 'bearer',
        endpoints: 2,
        aliases: 0,
      })
    })

    it('should list multiple services in pretty mode', async () => {
      // Create test configs
      const githubConfig = `
serviceName: github
baseUrl: https://api.github.com
authentication:
  type: bearer
  token: \${GITHUB_TOKEN}
endpoints:
  - name: listRepos
    method: GET
    path: /users/{username}/repos
aliases:
  - name: myRepos
    endpoint: listRepos
    args:
      username: testuser
`
      const weatherConfig = `
serviceName: weather
baseUrl: https://api.weather.com
endpoints:
  - name: current
    method: GET
    path: /weather/{city}
`
      await fs.writeFile(
        path.join(configDir, 'github.yaml'),
        githubConfig,
      )
      await fs.writeFile(
        path.join(configDir, 'weather.yaml'),
        weatherConfig,
      )

      const { stderr } = await runCommand('list services --pretty')

      expect(stderr).toContain('Found 2 configured service(s)')
      expect(stderr).toContain('github')
      expect(stderr).toContain('weather')
      expect(stderr).toContain('bearer')
      expect(stderr).toContain('none')
    })
  })

  describe('list endpoints', () => {
    beforeEach(async () => {
      // Create test config
      const config = `
serviceName: github
baseUrl: https://api.github.com
endpoints:
  - name: listRepos
    method: GET
    path: /users/{username}/repos
  - name: getRepo
    method: GET
    path: /repos/{owner}/{repo}
    cacheTTL: 300
`
      await fs.writeFile(path.join(configDir, 'github.yaml'), config)
    })

    it('should list endpoints for a service in JSON mode', async () => {
      const { stdout } = await runCommand('list endpoints github')

      const result = JSON.parse(stdout)
      expect(result.service).toBe('github')
      expect(result.endpoints).toHaveLength(2)
      expect(result.endpoints[0]).toMatchObject({
        name: 'listRepos',
        method: 'GET',
        path: '/users/{username}/repos',
        parameters: ['username'],
      })
      expect(result.endpoints[1]).toMatchObject({
        name: 'getRepo',
        method: 'GET',
        path: '/repos/{owner}/{repo}',
        cacheTTL: 300,
        parameters: ['owner', 'repo'],
      })
    })

    it('should list endpoints in pretty mode', async () => {
      const { stderr } = await runCommand(
        'list endpoints github --pretty',
      )

      expect(stderr).toContain("Endpoints for service 'github'")
      expect(stderr).toContain('listRepos')
      expect(stderr).toContain('GET')
      expect(stderr).toContain('/users/{username}/repos')
      expect(stderr).toContain('username')
      expect(stderr).toContain('300s')
      expect(stderr).toContain('owner, repo')
      expect(stderr).toContain('Usage: ovrmnd call github.<endpoint>')
    })

    it('should error when service not found', async () => {
      const { stderr, code } = await runCommand(
        'list endpoints nonexistent --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain("Service 'nonexistent' not found")
      expect(stderr).toContain('Use "ovrmnd list services"')
    })

    it('should error when service name not provided', async () => {
      const { stderr, code } = await runCommand(
        'list endpoints --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain('Not enough non-option arguments')
    })
  })

  describe('list aliases', () => {
    beforeEach(async () => {
      // Create test config
      const config = `
serviceName: github
baseUrl: https://api.github.com
endpoints:
  - name: listRepos
    method: GET
    path: /users/{username}/repos
  - name: getUser
    method: GET
    path: /users/{username}
aliases:
  - name: myRepos
    endpoint: listRepos
    args:
      username: testuser
  - name: me
    endpoint: getUser
    args:
      username: testuser
`
      await fs.writeFile(path.join(configDir, 'github.yaml'), config)
    })

    it('should list aliases for a service in JSON mode', async () => {
      const { stdout } = await runCommand('list aliases github')

      const result = JSON.parse(stdout)
      expect(result.service).toBe('github')
      expect(result.aliases).toHaveLength(2)
      expect(result.aliases[0]).toMatchObject({
        name: 'myRepos',
        endpoint: 'listRepos',
        description: 'username="testuser"',
        args: { username: 'testuser' },
      })
    })

    it('should list aliases in pretty mode', async () => {
      const { stderr } = await runCommand(
        'list aliases github --pretty',
      )

      expect(stderr).toContain("Aliases for service 'github'")
      expect(stderr).toContain('myRepos')
      expect(stderr).toContain('listRepos')
      expect(stderr).toContain('username="testuser"')
      expect(stderr).toContain('Usage: ovrmnd call github.<alias>')
    })

    it('should handle service with no aliases', async () => {
      // Create config without aliases
      const config = `
serviceName: weather
baseUrl: https://api.weather.com
endpoints:
  - name: current
    method: GET
    path: /weather/{city}
`
      await fs.writeFile(path.join(configDir, 'weather.yaml'), config)

      const { stderr } = await runCommand(
        'list aliases weather --pretty',
      )

      expect(stderr).toContain("Aliases for service 'weather'")
      expect(stderr).toContain('No aliases configured')
    })
  })

  describe('command validation', () => {
    it('should error on invalid resource', async () => {
      const { stderr, code } = await runCommand(
        'list invalid --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain('Invalid values')
      expect(stderr).toContain('Argument: resource')
      expect(stderr).toContain(
        'Choices: "services", "endpoints", "aliases"',
      )
    })

    it('should require service for endpoints', async () => {
      const { stderr, code } = await runCommand(
        'list endpoints --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain('Not enough non-option arguments')
    })

    it('should require service for aliases', async () => {
      const { stderr, code } = await runCommand(
        'list aliases --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain('Not enough non-option arguments')
    })
  })
})
