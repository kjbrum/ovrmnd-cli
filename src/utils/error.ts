import chalk from 'chalk'
import { createLogger } from './logger'

const logger = createLogger('error-handler')

export enum ErrorCode {
  // Configuration errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',

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
}

export class OvrmndError extends Error {
  code: ErrorCode
  details: unknown
  help: string | undefined
  statusCode: number | undefined

  constructor(options: ErrorOptions) {
    super(options.message)
    this.name = 'OvrmndError'
    this.code = options.code
    this.details = options.details
    this.help = options.help
    this.statusCode = options.statusCode
  }
}

export function handleError(error: unknown): void {
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
