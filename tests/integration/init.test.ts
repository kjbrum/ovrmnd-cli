import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as yaml from 'js-yaml'

describe('Init Command Integration', () => {
  let tempDir: string
  const cliPath = path.join(__dirname, '../../dist/cli.js')

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ovrmnd-init-test-'),
    )
    process.chdir(tempDir)
  })

  afterEach(() => {
    // Clean up temporary directory
    process.chdir(path.join(__dirname, '../..'))
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const runCommand = (args: string): string => {
    try {
      return execSync(`node ${cliPath} ${args}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error: any) {
      // For commands that exit with non-zero status
      return error.stdout || error.stderr || ''
    }
  }

  describe('JSON mode', () => {
    it('should create config file with service name', () => {
      const output = runCommand('init testapi')
      const result = JSON.parse(output)

      expect(result.success).toBe(true)
      expect(result.service).toBe('testapi')
      expect(result.path).toContain('testapi.yaml')

      // Verify file was created
      const filePath = path.join(tempDir, '.ovrmnd', 'testapi.yaml')
      expect(fs.existsSync(filePath)).toBe(true)

      // Verify YAML content
      const yamlContent = fs.readFileSync(filePath, 'utf-8')
      const config = yaml.load(yamlContent) as any

      expect(config.serviceName).toBe('testapi')
      expect(config.baseUrl).toBe('https://api.testapi.com/v1')
      expect(config.authentication.type).toBe('bearer')
      expect(config.endpoints).toHaveLength(5)
    })

    it('should fail without service name', () => {
      const output = runCommand('init')
      const result = JSON.parse(output)

      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('PARAM_REQUIRED')
    })

    it('should create file in global directory with --global', () => {
      const homeDir =
        process.env['HOME'] || process.env['USERPROFILE'] || ''
      // Use a unique name to avoid conflicts
      const uniqueName = `globaltest-${Date.now()}`
      const output = runCommand(`init ${uniqueName} --global`)

      let result
      try {
        result = JSON.parse(output)
      } catch (e) {
        console.error('Failed to parse output:', output)
        throw e
      }

      if (!result.success) {
        console.error('Command failed:', result)
      }

      expect(result.success).toBe(true)
      expect(result.path).toBe(
        path.join(homeDir, '.ovrmnd', `${uniqueName}.yaml`),
      )

      // Clean up the global file
      try {
        fs.unlinkSync(result.path)
      } catch (e) {
        // Ignore cleanup errors
      }
    })

    it('should fail if file exists without --force', () => {
      // Create the file first
      fs.mkdirSync(path.join(tempDir, '.ovrmnd'), { recursive: true })
      fs.writeFileSync(
        path.join(tempDir, '.ovrmnd', 'existing.yaml'),
        'test',
      )

      const output = runCommand('init existing')
      const result = JSON.parse(output)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File already exists')
      expect(result.hint).toBe('Use --force to overwrite')
    })

    it('should overwrite file with --force', () => {
      // Create the file first
      fs.mkdirSync(path.join(tempDir, '.ovrmnd'), { recursive: true })
      fs.writeFileSync(
        path.join(tempDir, '.ovrmnd', 'existing.yaml'),
        'old content',
      )

      const output = runCommand('init existing --force')
      const result = JSON.parse(output)

      expect(result.success).toBe(true)

      // Verify file was overwritten
      const yamlContent = fs.readFileSync(
        path.join(tempDir, '.ovrmnd', 'existing.yaml'),
        'utf-8',
      )
      expect(yamlContent).toContain('serviceName: existing')
      expect(yamlContent).not.toBe('old content')
    })

    it('should create file at custom output path', () => {
      // Create parent directory first
      const customDir = path.join(tempDir, 'custom')
      fs.mkdirSync(customDir, { recursive: true })

      const customPath = path.join(customDir, 'config.yml')
      const output = runCommand(
        `init myservice --output="${customPath}"`,
      )

      const result = JSON.parse(output)
      expect(result.success).toBe(true)
      expect(result.path).toBe(customPath)

      // Verify file was created at custom path
      expect(fs.existsSync(customPath)).toBe(true)
    })
  })

  describe('Template content', () => {
    it('should generate valid REST template', () => {
      runCommand('init restservice')

      const filePath = path.join(
        tempDir,
        '.ovrmnd',
        'restservice.yaml',
      )
      const yamlContent = fs.readFileSync(filePath, 'utf-8')
      const config = yaml.load(yamlContent) as any

      // Check authentication
      expect(config.authentication).toEqual({
        type: 'bearer',
        token: '${RESTSERVICE_API_TOKEN}',
      })

      // Check endpoints
      expect(config.endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list',
            method: 'GET',
            path: '/items',
            cacheTTL: 300,
          }),
          expect.objectContaining({
            name: 'get',
            method: 'GET',
            path: '/items/{id}',
            cacheTTL: 300,
          }),
          expect.objectContaining({
            name: 'create',
            method: 'POST',
            path: '/items',
            defaultParams: expect.objectContaining({
              name: 'Example Item',
              description: 'Example description',
            }),
          }),
          expect.objectContaining({
            name: 'update',
            method: 'PUT',
            path: '/items/{id}',
          }),
          expect.objectContaining({
            name: 'delete',
            method: 'DELETE',
            path: '/items/{id}',
          }),
        ]),
      )

      // Check aliases
      expect(config.aliases).toEqual([
        {
          name: 'first-item',
          endpoint: 'get',
          args: { id: '1' },
        },
      ])

      // Check transform on list endpoint
      expect(config.endpoints[0].transform).toEqual({
        fields: ['id', 'name', 'created_at'],
      })
    })

    it('should include helpful comments in YAML', () => {
      runCommand('init commented')

      const filePath = path.join(tempDir, '.ovrmnd', 'commented.yaml')
      const yamlContent = fs.readFileSync(filePath, 'utf-8')

      expect(yamlContent).toContain('# commented API Configuration')
      expect(yamlContent).toContain('# Generated by ovrmnd init')
      expect(yamlContent).toContain(
        '# Before using this configuration:',
      )
      expect(yamlContent).toContain(
        '# Usage: ovrmnd call commented.<endpoint>',
      )
    })
  })

  describe('Pretty mode', () => {
    // Skip interactive tests in integration tests
    // The interactive prompts require stdin input which is difficult to test in this context
    it.skip('should output human-readable success message', () => {
      const output = runCommand('init prettytest --pretty')

      expect(output).toContain('✓ Created')
      expect(output).toContain('prettytest.yaml')
      expect(output).toContain('Next steps:')
      expect(output).toContain('PRETTYTEST_API_TOKEN')
      expect(output).toContain('ovrmnd call prettytest')
    })
  })
})
