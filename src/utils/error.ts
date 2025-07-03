import chalk from 'chalk'
import { createLogger } from './logger'
import type { ErrorContext, JsonError } from '../types'

const logger = createLogger('error-handler')

export enum ErrorCode {
  // Configuration errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',
  CONFIG_VALIDATION_ERROR = 'CONFIG_VALIDATION_ERROR',

  // Authentication errors
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_FAILED = 'AUTH_FAILED',

  // API errors
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_RESPONSE_INVALID = 'API_RESPONSE_INVALID',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMITED = 'API_RATE_LIMITED',

  // Parameter errors
  PARAM_REQUIRED = 'PARAM_REQUIRED',
  PARAM_INVALID = 'PARAM_INVALID',
  PARAM_TYPE_MISMATCH = 'PARAM_TYPE_MISMATCH',

  // Environment errors
  ENV_VAR_NOT_FOUND = 'ENV_VAR_NOT_FOUND',

  // Service errors
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',

  // YAML errors
  YAML_PARSE_ERROR = 'YAML_PARSE_ERROR',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // Cache errors
  CACHE_READ_ERROR = 'CACHE_READ_ERROR',
  CACHE_WRITE_ERROR = 'CACHE_WRITE_ERROR',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ErrorOptions {
  code: ErrorCode
  message: string
  details?: unknown
  help?: string
  statusCode?: number
  context?: ErrorContext
}

export class OvrmndError extends Error {
  code: ErrorCode
  details: unknown
  help: string | undefined
  statusCode: number | undefined
  context: ErrorContext | undefined

  constructor(options: ErrorOptions) {
    super(options.message)
    this.name = 'OvrmndError'
    this.code = options.code
    this.details = options.details
    this.help = options.help
    this.statusCode = options.statusCode
    this.context = options.context
  }

  toJsonError(): JsonError {
    const error: JsonError['error'] = {
      code: this.code,
      message: this.message,
    }

    if (this.details !== undefined) {
      error.details = this.details
    }

    if (this.help !== undefined) {
      error.help = this.help
    }

    const jsonError: JsonError = {
      error,
      timestamp: new Date().toISOString(),
    }

    if (this.context?.request) {
      jsonError.request = this.context.request
    }

    if (this.context?.response) {
      jsonError.response = this.context.response
    }

    return jsonError
  }
}

export function handleError(
  error: unknown,
  jsonMode: boolean = false,
): void {
  if (jsonMode) {
    // In JSON mode, output structured error to stderr
    let errorOutput: JsonError

    if (error instanceof OvrmndError) {
      errorOutput = error.toJsonError()
    } else if (error instanceof Error) {
      errorOutput = {
        error: {
          code: 'UNKNOWN_ERROR',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      }
    } else {
      errorOutput = {
        error: {
          code: 'UNKNOWN_ERROR',
          message: String(error),
        },
        timestamp: new Date().toISOString(),
      }
    }

    console.error(JSON.stringify(errorOutput, null, 2))

    // Still log for debugging
    if (error instanceof OvrmndError) {
      logger.error('OvrmndError', {
        code: error.code,
        message: error.message,
        details: error.details,
        statusCode: error.statusCode,
      })
    } else if (error instanceof Error) {
      logger.error('Unhandled error', {
        message: error.message,
        stack: error.stack,
      })
    } else {
      logger.error('Unknown error type', { error })
    }
  } else {
    // Human-readable error output
    if (error instanceof OvrmndError) {
      // Handle our custom errors
      console.error(chalk.red(`Error: ${error.message}`))

      if (error.details) {
        console.error(chalk.gray('Details:'), error.details)
      }

      if (error.help) {
        console.error(chalk.yellow('Help:'), error.help)
      }

      logger.error('OvrmndError', {
        code: error.code,
        message: error.message,
        details: error.details,
        statusCode: error.statusCode,
      })
    } else if (error instanceof Error) {
      // Handle standard errors
      console.error(chalk.red(`Error: ${error.message}`))

      if (process.env['DEBUG'] === 'true' && error.stack) {
        console.error(chalk.gray(error.stack))
      }

      logger.error('Unhandled error', {
        message: error.message,
        stack: error.stack,
      })
    } else {
      // Handle unknown error types
      console.error(chalk.red('An unknown error occurred'))
      console.error(error)

      logger.error('Unknown error type', { error })
    }
  }
}

export function formatError(error: unknown): string {
  if (error instanceof OvrmndError) {
    return `[${error.code}] ${error.message}`
  } else if (error instanceof Error) {
    return error.message
  } else {
    return String(error)
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof OvrmndError) {
    return [
      ErrorCode.API_TIMEOUT,
      ErrorCode.API_RATE_LIMITED,
      ErrorCode.API_REQUEST_FAILED,
    ].includes(error.code)
  }

  if (error instanceof Error) {
    // Check for common retryable network errors
    const message = error.message.toLowerCase()
    return (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('econnreset')
    )
  }

  return false
}
