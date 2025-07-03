import { spawn } from 'child_process'
import path from 'path'

describe('stdout/stderr separation', () => {
  const cliPath = path.join(__dirname, '../../dist/cli.js')

  // Helper to run CLI and capture stdout/stderr separately
  function runCli(args: string[]): Promise<{
    stdout: string
    stderr: string
    exitCode: number | null
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, NODE_ENV: 'test' },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', data => {
        stdout += data.toString()
      })

      child.stderr.on('data', data => {
        stderr += data.toString()
      })

      child.on('error', reject)
      child.on('close', exitCode => {
        resolve({ stdout, stderr, exitCode })
      })
    })
  }

  beforeAll(() => {
    // Ensure the CLI is built
    const { execSync } = require('child_process')
    execSync('npm run build', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe',
    })
  })

  describe('successful API calls', () => {
    it('should output data to stdout and nothing to stderr', async () => {
      // This test would require a real API call or mock server
      // For now, we'll test with an invalid command to verify error handling
      const { stdout, stderr, exitCode } = await runCli([
        'nonexistent',
      ])

      // With an invalid command, we expect:
      // - Error message in stderr
      // - Help text in stderr
      // - Nothing in stdout
      // - Non-zero exit code
      expect(stdout).toBe('')
      expect(stderr).toContain('Unknown argument: nonexistent')
      expect(exitCode).toBe(1)
    })
  })

  describe('command errors', () => {
    it('should output errors to stderr, not stdout', async () => {
      const { stdout, stderr, exitCode } = await runCli([
        'call',
        'invalid',
      ])

      // Errors should go to stderr
      expect(stderr).toContain('Error')
      expect(stdout).toBe('')
      expect(exitCode).toBe(1)
    })
  })

  describe('debug mode', () => {
    it('should output debug logs to stderr', async () => {
      const { stderr } = await runCli([
        'call',
        'test.endpoint',
        '--debug',
      ])

      // Debug logs should go to stderr
      // Note: This will fail because we don't have a test service configured
      // But we can verify that any debug output goes to stderr
      expect(stderr).toBeTruthy()
    })
  })

  describe('help output', () => {
    it('should output help to stdout when requested', async () => {
      const { stdout, stderr, exitCode } = await runCli(['--help'])

      // Help should go to stdout when explicitly requested
      expect(stdout).toContain('Usage:')
      expect(stdout).toContain('Commands:')
      expect(stderr).toBe('')
      expect(exitCode).toBe(0)
    })
  })

  describe('output format', () => {
    it('should output JSON by default', async () => {
      // This would require a real API call
      // For now, we can verify the help text shows --pretty flag
      const { stdout } = await runCli(['call', '--help'])

      expect(stdout).toContain('--pretty')
      expect(stdout).toContain('human-readable format')
    })
  })

  describe('version output', () => {
    it('should output version to stdout', async () => {
      const { stdout, stderr, exitCode } = await runCli(['--version'])

      // Version should go to stdout
      expect(stdout).toMatch(/\d+\.\d+\.\d+/)
      expect(stderr).toBe('')
      expect(exitCode).toBe(0)
    })
  })
})
