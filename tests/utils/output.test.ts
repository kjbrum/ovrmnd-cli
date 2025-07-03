import { OutputFormatter } from '../../src/utils/output'
import { OvrmndError, ErrorCode } from '../../src/utils/error'
import type { ErrorContext } from '../../src/types'

describe('OutputFormatter - Error Handling', () => {
  describe('formatError', () => {
    it('should format OvrmndError with full context in JSON mode', () => {
      const formatter = new OutputFormatter(true)
      const context: ErrorContext = {
        request: {
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: { Authorization: 'Bea****oken' },
        },
        response: {
          status: 404,
          statusText: 'Not Found',
          body: { error: 'User not found' },
        },
      }

      const error = new OvrmndError({
        code: ErrorCode.API_REQUEST_FAILED,
        message: 'HTTP 404: Not Found',
        statusCode: 404,
        details: { error: 'User not found' },
        help: 'Check if the user ID exists',
        context,
      })

      const output = formatter.formatError(error)
      const parsed = JSON.parse(output)

      expect(parsed).toHaveProperty('error')
      expect(parsed.error).toEqual({
        code: 'API_REQUEST_FAILED',
        message: 'HTTP 404: Not Found',
        details: { error: 'User not found' },
        help: 'Check if the user ID exists',
      })
      expect(parsed).toHaveProperty('request')
      expect(parsed.request).toEqual(context.request)
      expect(parsed).toHaveProperty('response')
      expect(parsed.response).toEqual(context.response)
      expect(parsed).toHaveProperty('timestamp')
    })

    it('should format OvrmndError without optional fields in JSON mode', () => {
      const formatter = new OutputFormatter(true)
      const error = new OvrmndError({
        code: ErrorCode.CONFIG_NOT_FOUND,
        message: 'Configuration file not found',
      })

      const output = formatter.formatError(error)
      const parsed = JSON.parse(output)

      expect(parsed).toHaveProperty('error')
      expect(parsed.error).toEqual({
        code: 'CONFIG_NOT_FOUND',
        message: 'Configuration file not found',
      })
      expect(parsed).not.toHaveProperty('request')
      expect(parsed).not.toHaveProperty('response')
      expect(parsed).toHaveProperty('timestamp')
    })

    it('should format standard Error in JSON mode', () => {
      const formatter = new OutputFormatter(true)
      const error = new Error('Something went wrong')

      const output = formatter.formatError(error)
      const parsed = JSON.parse(output)

      expect(parsed).toHaveProperty('error')
      expect(parsed.error).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
      })
      expect(parsed).toHaveProperty('timestamp')
    })

    it('should format OvrmndError in human-readable mode', () => {
      const formatter = new OutputFormatter(false)
      const error = new OvrmndError({
        code: ErrorCode.API_REQUEST_FAILED,
        message: 'HTTP 404: Not Found',
        statusCode: 404,
        details: { error: 'User not found' },
        help: 'Check if the user ID exists',
      })

      const output = formatter.formatError(error)

      expect(output).toContain('[API_REQUEST_FAILED]')
      expect(output).toContain('HTTP 404: Not Found')
      expect(output).toContain('Details:')
      expect(output).toContain('User not found')
      expect(output).toContain('Help:')
      expect(output).toContain('Check if the user ID exists')
      expect(output).toContain('Status Code:')
      expect(output).toContain('404')
    })

    it('should format standard Error in human-readable mode', () => {
      const formatter = new OutputFormatter(false)
      const error = new Error('Something went wrong')

      const output = formatter.formatError(error)

      expect(output).toContain('Something went wrong')
      expect(output).toContain('✗')
    })

    it('should format non-Error objects', () => {
      const formatter = new OutputFormatter(true)
      const error = 'String error'

      const output = formatter.formatError(error)
      const parsed = JSON.parse(output)

      expect(parsed.error.message).toBe('String error')
    })
  })

  describe('error method compatibility', () => {
    it('should maintain backward compatibility with error method', () => {
      const formatter = new OutputFormatter(true)
      const output = formatter.error('Test error', { foo: 'bar' })
      const parsed = JSON.parse(output)

      expect(parsed).toEqual({
        error: 'Test error',
        details: { foo: 'bar' },
      })
    })
  })
})
