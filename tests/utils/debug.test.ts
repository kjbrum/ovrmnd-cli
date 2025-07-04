import { DebugFormatter } from '../../src/utils/debug'

describe('DebugFormatter', () => {
  let processStderrSpy: jest.SpyInstance

  beforeEach(() => {
    processStderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should default to disabled', () => {
      const formatter = new DebugFormatter()
      expect(formatter.isEnabled).toBe(false)
    })

    it('should accept enabled flag', () => {
      const formatter = new DebugFormatter(true)
      expect(formatter.isEnabled).toBe(true)
    })
  })

  describe('debug', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.debug('TEST', 'This should not appear')
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should output debug info when enabled', () => {
      const formatter = new DebugFormatter(true)
      formatter.debug('TEST', 'Debug message')

      expect(processStderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
      )
      expect(processStderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
      )
      expect(processStderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message'),
      )
    })

    it('should format data when provided', () => {
      const formatter = new DebugFormatter(true)
      formatter.debug('TEST', 'With data', { key: 'value' })

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')
      expect(output).toContain('"key": "value"')
    })
  })

  describe('formatRequest', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatRequest('GET', 'https://api.test.com', {}, {})
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format request details', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatRequest(
        'POST',
        'https://api.test.com/users',
        { 'Content-Type': 'application/json' },
        { name: 'John' },
      )

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[REQUEST]')
      expect(output).toContain('POST https://api.test.com/users')
      expect(output).toContain('Headers:')
      expect(output).toContain('"Content-Type": "application/json"')
      expect(output).toContain('Body:')
      expect(output).toContain('"name": "John"')
    })

    it('should redact authorization headers', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatRequest('GET', 'https://api.test.com', {
        Authorization: 'Bearer secret-token',
      })

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('"Authorization": "Bear...oken"')
      expect(output).not.toContain('secret-token')
    })
  })

  describe('formatResponse', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatResponse(200, 'OK', {}, {})
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format response details', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatResponse(
        200,
        'OK',
        { 'Content-Type': 'application/json' },
        { id: 1, name: 'Test' },
      )

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[RESPONSE]')
      expect(output).toContain('200 OK')
      expect(output).toContain('Headers:')
      expect(output).toContain('"Content-Type": "application/json"')
      expect(output).toContain('Body:')
      expect(output).toContain('"id": 1')
    })

    it('should truncate very long responses', () => {
      const formatter = new DebugFormatter(true)
      const longData = Array(100)
        .fill(null)
        .map((_, i) => ({ id: i, data: 'x'.repeat(100) }))

      formatter.formatResponse(200, 'OK', {}, longData)

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('Body (truncated):')
      expect(output).toContain('... ')
      expect(output).toContain(' more lines ...')
    })
  })

  describe('formatConfigResolution', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatConfigResolution(
        'test',
        '/path/to/config',
        true,
      )
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format config resolution for global config', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatConfigResolution(
        'github',
        '/home/user/.ovrmnd/github.yaml',
        true,
      )

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[CONFIG]')
      expect(output).toContain(
        "Loading service 'github' from global config",
      )
      expect(output).toContain('/home/user/.ovrmnd/github.yaml')
    })

    it('should format config resolution for local config', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatConfigResolution(
        'api',
        '/project/.ovrmnd/api.yaml',
        false,
      )

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[CONFIG]')
      expect(output).toContain(
        "Loading service 'api' from local config",
      )
      expect(output).toContain('/project/.ovrmnd/api.yaml')
    })
  })

  describe('formatParameterMapping', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatParameterMapping('test', {}, {})
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format parameter mapping details', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatParameterMapping(
        'getUser',
        { id: '123', fields: 'name,email' },
        {
          path: { id: '123' },
          query: { fields: 'name,email' },
        },
      )

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[PARAMS]')
      expect(output).toContain(
        "Mapping parameters for endpoint 'getUser'",
      )
      expect(output).toContain('Raw parameters:')
      expect(output).toContain('"id": "123"')
      expect(output).toContain('Mapped parameters:')
      expect(output).toContain('path')
      expect(output).toContain('query')
    })
  })

  describe('formatEnvResolution', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatEnvResolution('API_KEY', true, 'secret')
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format successful env var resolution', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatEnvResolution('API_KEY', true, 'secret-key-123')

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[ENV]')
      expect(output).toContain('Resolved API_KEY = ********')
      expect(output).not.toContain('secret-key-123')
    })

    it('should format failed env var resolution', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatEnvResolution('MISSING_VAR', false)

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[ENV]')
      expect(output).toContain('Warning: MISSING_VAR is not set')
    })
  })

  describe('formatCacheInfo', () => {
    it('should not output when disabled', () => {
      const formatter = new DebugFormatter(false)
      formatter.formatCacheInfo('test', 'cache-key', true, 300)
      expect(processStderrSpy).not.toHaveBeenCalled()
    })

    it('should format cache hit', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatCacheInfo('listUsers', 'users:all', true, 300)

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[CACHE]')
      expect(output).toContain('Cache HIT')
      expect(output).toContain("for endpoint 'listUsers'")
      expect(output).toContain('(TTL: 300s)')
      expect(output).toContain('"key": "users:all"')
    })

    it('should format cache miss', () => {
      const formatter = new DebugFormatter(true)
      formatter.formatCacheInfo('getUser', 'user:123', false)

      const calls = processStderrSpy.mock.calls
      const output = calls.map(call => call[0]).join('')

      expect(output).toContain('[CACHE]')
      expect(output).toContain('Cache MISS')
      expect(output).toContain("for endpoint 'getUser'")
      expect(output).toContain('"key": "user:123"')
    })
  })
})
