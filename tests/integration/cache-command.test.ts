import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { CacheStorage } from '../../src/cache/storage'

const execAsync = promisify(exec)

describe('Cache Command Integration', () => {
  let tempDir: string
  let configDir: string
  let cacheDir: string
  let cacheStorage: CacheStorage

  beforeEach(async () => {
    // Create temp directories for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ovrmnd-test-'))
    configDir = path.join(tempDir, '.ovrmnd')
    cacheDir = path.join(tempDir, 'cache')
    await fs.mkdir(configDir, { recursive: true })
    await fs.mkdir(cacheDir, { recursive: true })

    // Create a test config
    const testConfig = `
serviceName: testing
baseUrl: https://jsonplaceholder.typicode.com
endpoints:
  - name: listUsers
    method: GET
    path: /users
    cacheTTL: 300
  - name: getUser
    method: GET
    path: /users/{id}
    cacheTTL: 600
`
    await fs.writeFile(
      path.join(configDir, 'testing.yaml'),
      testConfig,
    )

    // Initialize cache storage with custom dir
    cacheStorage = new CacheStorage(cacheDir)
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  const runCommand = async (command: string) => {
    const env = {
      ...process.env,
      OVRMND_CACHE_DIR: cacheDir, // Use custom cache dir for tests
    }
    const fullCommand = `node dist/cli.js ${command} --config ${configDir}`
    try {
      const { stdout, stderr } = await execAsync(fullCommand, { env })
      return { stdout, stderr, code: 0 }
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.code || 1,
      }
    }
  }

  describe('cache stats', () => {
    it('should show empty cache stats', async () => {
      const { stderr } = await runCommand('cache stats --pretty')

      expect(stderr).toContain('Cache Statistics:')
      expect(stderr).toContain('Total entries: 0')
      expect(stderr).toContain('Total size: 0.0 B')
    })

    it('should show cache stats after caching data', async () => {
      // First, make some API calls to populate cache
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')

      const { stderr } = await runCommand('cache stats --pretty')

      expect(stderr).toContain('Total entries: 2')
      expect(stderr).toMatch(/Total size: \d+\.\d+ [KM]?B/)
    })

    it('should show detailed stats with verbose flag', async () => {
      // Populate cache
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')

      const { stderr } = await runCommand(
        'cache stats --pretty --verbose',
      )

      expect(stderr).toContain('By Service:')
      expect(stderr).toContain('testing')
      expect(stderr).toContain('% of Total')
    })

    it('should output JSON format', async () => {
      const { stdout } = await runCommand('cache stats')

      const stats = JSON.parse(stdout)
      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('totalSize')
      expect(stats).toHaveProperty('byService')
    })
  })

  describe('cache list', () => {
    it('should show empty cache list', async () => {
      const { stderr } = await runCommand('cache list --pretty')

      expect(stderr).toContain('No cached entries found')
    })

    it('should list cached entries', async () => {
      // Populate cache
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')

      const { stderr } = await runCommand('cache list --pretty')

      expect(stderr).toContain('Cached entries:')
      expect(stderr).toContain('testing.listUsers')
      expect(stderr).toContain('testing.getUser')
      expect(stderr).toContain('Total: 2 entries')
    })

    it('should filter by service', async () => {
      // Populate cache
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')

      const { stderr } = await runCommand(
        'cache list testing.listUsers --pretty',
      )

      expect(stderr).toContain(
        'Cached entries for testing.listUsers:',
      )
      expect(stderr).toContain('testing.listUsers')
      expect(stderr).not.toContain('testing.getUser')
    })

    it('should show verbose details', async () => {
      // Populate cache
      await runCommand('call testing.listUsers')

      const { stderr } = await runCommand(
        'cache list --pretty --verbose',
      )

      expect(stderr).toContain('Key:')
      expect(stderr).toContain('URL:')
      expect(stderr).toContain('Cached:')
      expect(stderr).toContain('Expires:')
      expect(stderr).toContain('TTL remaining:')
      expect(stderr).toContain('Size:')
      expect(stderr).toContain('Status:')
    })

    it('should output JSON format', async () => {
      await runCommand('call testing.listUsers')

      const { stdout } = await runCommand('cache list')

      const result = JSON.parse(stdout)
      expect(result).toHaveProperty('entries')
      expect(Array.isArray(result.entries)).toBe(true)
    })
  })

  describe('cache clear', () => {
    beforeEach(async () => {
      // Populate cache with test data
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')
    })

    it('should clear all cache with force flag', async () => {
      // Verify cache has entries
      let stats = cacheStorage.getStats()
      expect(stats.totalEntries).toBeGreaterThan(0)

      const { stderr } = await runCommand(
        'cache clear --pretty --force',
      )

      expect(stderr).toContain('Cleared')
      expect(stderr).toContain('cache entries')

      // Verify cache is empty
      stats = cacheStorage.getStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should clear specific service cache', async () => {
      const { stderr } = await runCommand(
        'cache clear testing.listUsers --pretty --force',
      )

      expect(stderr).toContain('Cleared')

      // Verify only specific entries were cleared
      const entries = cacheStorage.getAllEntries()
      const hasListUsers = entries.some(e =>
        e.key.includes('testing.listUsers'),
      )
      const hasGetUser = entries.some(e =>
        e.key.includes('testing.getUser'),
      )

      expect(hasListUsers).toBe(false)
      expect(hasGetUser).toBe(true)
    })

    it('should handle no entries to clear', async () => {
      // Clear first
      await runCommand('cache clear --force')

      // Try to clear again
      const { stderr } = await runCommand(
        'cache clear --pretty --force',
      )

      expect(stderr).toContain('No cache entries to clear')
    })

    it('should output JSON format', async () => {
      const { stdout } = await runCommand('cache clear --force')

      const result = JSON.parse(stdout)
      expect(result).toMatchObject({
        action: 'clear',
        target: 'all',
        cleared: expect.any(Number),
        success: true,
      })
    })

    it('should require confirmation without force flag', async () => {
      // This test would need to simulate user input
      // For now, we'll test that it exits without force in CI
      const { stderr, code } = await runCommand(
        'cache clear --pretty',
      )

      // In CI/non-interactive mode, prompts will auto-reject
      expect(code).toBe(0)
      expect(stderr).toMatch(/cancelled|Cache clear cancelled/i)
    })
  })

  describe('error handling', () => {
    it('should error on invalid action', async () => {
      const { stderr, code } = await runCommand(
        'cache invalid --pretty',
      )

      expect(code).toBe(1)
      expect(stderr).toContain('Invalid values')
      expect(stderr).toContain('Argument: action')
    })

    it('should handle cache errors gracefully', async () => {
      // Make cache directory read-only to trigger error
      await fs.chmod(cacheDir, 0o444)

      const { stderr } = await runCommand('cache stats --pretty')

      // Should still show output even if cache has issues
      expect(stderr).toContain('Cache Statistics:')

      // Restore permissions
      await fs.chmod(cacheDir, 0o755)
    })
  })

  describe('cache lifecycle', () => {
    it('should show complete cache lifecycle', async () => {
      // 1. Start with empty cache
      let result = await runCommand('cache stats')
      let stats = JSON.parse(result.stdout)
      expect(stats.totalEntries).toBe(0)

      // 2. Make API calls to populate cache
      await runCommand('call testing.listUsers')
      await runCommand('call testing.getUser id=1')
      await runCommand('call testing.getUser id=2')

      // 3. Check cache is populated
      result = await runCommand('cache stats')
      stats = JSON.parse(result.stdout)
      expect(stats.totalEntries).toBe(3)

      // 4. List cache entries
      result = await runCommand('cache list')
      const list = JSON.parse(result.stdout)
      expect(list.entries).toHaveLength(3)

      // 5. Clear specific endpoint
      await runCommand('cache clear testing.listUsers --force')

      // 6. Verify partial clear
      result = await runCommand('cache stats')
      stats = JSON.parse(result.stdout)
      expect(stats.totalEntries).toBe(2)

      // 7. Clear all
      await runCommand('cache clear --force')

      // 8. Verify complete clear
      result = await runCommand('cache stats')
      stats = JSON.parse(result.stdout)
      expect(stats.totalEntries).toBe(0)
    })
  })
})
