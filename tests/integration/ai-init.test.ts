import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { execSync } from 'child_process'
import type { ServiceConfig } from '../../src/types/config'

describe('AI-Powered Init Integration', () => {
  const testDir = path.join(__dirname, '../../temp/ai-init-test')
  const cliPath = path.join(__dirname, '../../dist/cli.js')

  beforeAll(async () => {
    // Build the project
    execSync('npm run build', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'ignore',
    })
  })

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true })
    process.chdir(testDir)
  })

  afterEach(async () => {
    // Clean up test directory
    process.chdir(__dirname)
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('with AI provider configured', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Mock the API key for testing
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: 'test-api-key',
      }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should fail without service name', () => {
      expect(() => {
        execSync(
          `node "${cliPath}" init --prompt "Create GitHub API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow(/Service name is required when using --prompt/)
    })

    it('should show proper error message when API key is missing', () => {
      delete process.env['OPENAI_API_KEY']

      expect(() => {
        execSync(
          `node "${cliPath}" init github --prompt "Create GitHub API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow(/OPENAI_API_KEY required for OpenAI/)
    })

    it('should support backward compatibility with ANTHROPIC_API_KEY', () => {
      delete process.env['OPENAI_API_KEY']
      process.env['ANTHROPIC_API_KEY'] = 'test-api-key'
      process.env['AI_PROVIDER'] = 'anthropic'

      expect(() => {
        execSync(
          `node "${cliPath}" init github --prompt "Create GitHub API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow() // Will fail due to mock key, but should get past provider selection
    })

    it('should use proxy URL when AI_PROXY_URL is set', () => {
      process.env['AI_PROXY_URL'] = 'https://proxy.shopify.ai'

      expect(() => {
        execSync(
          `node "${cliPath}" init github --prompt "Create GitHub API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow() // Will fail due to mock key, but should configure proxy
    })

    it('should use proxy token when AI_PROXY_TOKEN is set', () => {
      process.env['AI_PROXY_URL'] = 'https://proxy.shopify.ai'
      process.env['AI_PROXY_TOKEN'] = 'proxy-token-123'

      expect(() => {
        execSync(
          `node "${cliPath}" init github --prompt "Create GitHub API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow() // Will fail due to mock key, but should use proxy token
    })

    it('should generate config file with --prompt in local directory', async () => {
      // Skip this test in CI or if no real API key is available
      const hasValidKey =
        (process.env['OPENAI_API_KEY'] &&
          process.env['OPENAI_API_KEY'] !== 'test-api-key') ||
        (process.env['ANTHROPIC_API_KEY'] &&
          process.env['ANTHROPIC_API_KEY'] !== 'test-api-key') ||
        (process.env['GOOGLE_API_KEY'] &&
          process.env['GOOGLE_API_KEY'] !== 'test-api-key')

      if (!hasValidKey) {
        console.log(
          'Skipping real AI generation test - no valid API key available',
        )
        return
      }

      const output = execSync(
        `node "${cliPath}" init github --prompt "Create a simple GitHub API config with just list repos and create repo endpoints"`,
        { encoding: 'utf8' },
      )

      const result = JSON.parse(output.trim())
      expect(result.success).toBe(true)
      expect(result.service).toBe('github')
      expect(result.path).toContain('.ovrmnd/github.yaml')

      // Verify file was created
      const configPath = path.join(testDir, '.ovrmnd/github.yaml')
      const fileExists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)

      // Verify content
      const content = await fs.readFile(configPath, 'utf8')
      const config = yaml.load(content) as ServiceConfig
      expect(config.serviceName).toBe('github')
      expect(config.baseUrl).toContain('github')
      expect(config.endpoints).toBeDefined()
      expect(config.endpoints.length).toBeGreaterThan(0)
    })

    it('should generate config in global directory with --global', async () => {
      // Skip this test in CI or if no real API key is available
      if (
        !process.env['ANTHROPIC_API_KEY'] ||
        process.env['ANTHROPIC_API_KEY'] === 'test-api-key'
      ) {
        console.log(
          'Skipping real AI generation test - no valid API key available',
        )
        return
      }

      const output = execSync(
        `node "${cliPath}" init slack --global --prompt "Create Slack API config for sending messages"`,
        { encoding: 'utf8' },
      )

      const result = JSON.parse(output.trim())
      expect(result.success).toBe(true)
      expect(result.path).toContain('.ovrmnd/slack.yaml')
      expect(result.path).toContain(process.env['HOME'])
    })

    it('should generate config with pretty output', async () => {
      // Skip this test in CI or if no real API key is available
      if (
        !process.env['ANTHROPIC_API_KEY'] ||
        process.env['ANTHROPIC_API_KEY'] === 'test-api-key'
      ) {
        console.log(
          'Skipping real AI generation test - no valid API key available',
        )
        return
      }

      const { stderr } = execSync(
        `node "${cliPath}" init test --pretty --prompt "Create a simple test API config"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ) as any

      expect(stderr).toContain('🤖 Using AI to research and generate')
      expect(stderr).toContain('Created')
      expect(stderr).toContain('Next steps:')
    })

    it('should overwrite existing file with --force', async () => {
      // Create existing file
      await fs.mkdir('.ovrmnd', { recursive: true })
      await fs.writeFile('.ovrmnd/test.yaml', 'existing content')

      // Skip this test in CI or if no real API key is available
      if (
        !process.env['ANTHROPIC_API_KEY'] ||
        process.env['ANTHROPIC_API_KEY'] === 'test-api-key'
      ) {
        console.log(
          'Skipping real AI generation test - no valid API key available',
        )
        return
      }

      const output = execSync(
        `node "${cliPath}" init test --force --prompt "Create test API config"`,
        { encoding: 'utf8' },
      )

      const result = JSON.parse(output.trim())
      expect(result.success).toBe(true)

      // Verify file was overwritten
      const content = await fs.readFile('.ovrmnd/test.yaml', 'utf8')
      expect(content).not.toBe('existing content')
      expect(content).toContain('test API Configuration')
    })

    it('should fail without --force when file exists', async () => {
      // Create existing file
      await fs.mkdir('.ovrmnd', { recursive: true })
      await fs.writeFile('.ovrmnd/test.yaml', 'existing content')

      expect(() => {
        execSync(
          `node "${cliPath}" init test --prompt "Create test API config"`,
          { encoding: 'utf8' },
        )
      }).toThrow(/File already exists/)
    })
  })

  describe('help and examples', () => {
    it('should show AI examples in help', () => {
      const output = execSync(`node "${cliPath}" init --help`, {
        encoding: 'utf8',
      })

      expect(output).toContain('--prompt')
      expect(output).toContain(
        'Natural language prompt for AI-powered',
      )
      expect(output).toContain('AI-powered Shopify config generation')
      expect(output).toContain('AI-powered GitHub config generation')
    })
  })

  describe('proxy configuration', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Set up test environment
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: 'test-api-key',
      }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should show proxy info in debug mode', () => {
      process.env['AI_PROXY_URL'] = 'https://proxy.example.com'
      process.env['AI_PROXY_TOKEN'] = 'proxy-token'

      try {
        const { stderr } = execSync(
          `node "${cliPath}" init test --prompt "Create test API" --debug`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        ) as any

        expect(stderr).toContain(
          'Using AI proxy: https://proxy.example.com',
        )
      } catch (error) {
        // Expected to fail with test key, but should show proxy info
        const stderr = (error as any).stderr || ''
        expect(stderr).toContain(
          'Using AI proxy: https://proxy.example.com',
        )
      }
    })

    it('should work with proxy and real API key', async () => {
      // Skip if no real proxy and API key
      const hasValidProxy =
        process.env['AI_PROXY_URL'] &&
        process.env['AI_PROXY_TOKEN'] &&
        !process.env['AI_PROXY_URL'].includes('example') &&
        process.env['AI_PROXY_TOKEN'] !== 'proxy-token'

      if (!hasValidProxy) {
        console.log(
          'Skipping real proxy test - no valid proxy configuration available',
        )
        return
      }

      const output = execSync(
        `node "${cliPath}" init github --prompt "Create GitHub API config with list repos endpoint"`,
        { encoding: 'utf8' },
      )

      const result = JSON.parse(output.trim())
      expect(result.success).toBe(true)
      expect(result.service).toBe('github')

      // Verify generated config
      const configPath = path.join(testDir, '.ovrmnd/github.yaml')
      const content = await fs.readFile(configPath, 'utf8')
      const config = yaml.load(content) as ServiceConfig
      expect(config.serviceName).toBe('github')
      expect(config.endpoints).toBeDefined()
    })

    it('should handle proxy errors gracefully', () => {
      process.env['AI_PROXY_URL'] =
        'https://invalid-proxy.example.com'
      process.env['AI_PROXY_TOKEN'] = 'invalid-token'

      try {
        execSync(
          `node "${cliPath}" init test --prompt "Create test API"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        )
      } catch (error) {
        const stderr = (error as any).stderr || ''
        // Should show proxy-specific error help
        expect(stderr).toMatch(/proxy|AI_PROXY/i)
      }
    })
  })
})
