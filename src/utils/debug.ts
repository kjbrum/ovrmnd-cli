import chalk from 'chalk'
import { redactAuth } from '../api/auth'

/**
 * Debug output formatter for consistent debug information display
 */
export class DebugFormatter {
  private enabled: boolean

  constructor(enabled: boolean = false) {
    this.enabled = enabled
  }

  /**
   * Check if debug mode is enabled
   */
  get isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Format and output debug information to stderr
   */
  debug(category: string, message: string, data?: unknown): void {
    if (!this.enabled) return

    const timestamp = new Date().toISOString()
    const prefix = `${chalk.gray(`[${timestamp}]`)} ${chalk.blue('[DEBUG]')}`
    const categoryStr = chalk.cyan(`[${category}]`)

    process.stderr.write(`${prefix} ${categoryStr} ${message}\n`)

    if (data !== undefined) {
      const formatted = this.formatData(data)
      process.stderr.write(`${formatted}\n`)
    }
  }

  /**
   * Format request details for debug output
   */
  formatRequest(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: unknown,
  ): void {
    if (!this.enabled) return

    this.debug('REQUEST', `${method} ${url}`)

    if (headers && Object.keys(headers).length > 0) {
      const redactedHeaders = redactAuth(headers)
      process.stderr.write(
        chalk.gray('  Headers:\n') +
          this.formatObject(redactedHeaders, 4),
      )
    }

    if (body !== undefined) {
      process.stderr.write(
        chalk.gray('  Body:\n') + this.formatData(body, 4),
      )
    }
  }

  /**
   * Format response details for debug output
   */
  formatResponse(
    status: number,
    statusText: string,
    headers?: Record<string, string>,
    body?: unknown,
    responseTime?: number,
  ): void {
    if (!this.enabled) return

    const statusColor =
      status >= 200 && status < 300 ? chalk.green : chalk.red
    const timeStr = responseTime ? ` (${responseTime}ms)` : ''
    this.debug(
      'RESPONSE',
      statusColor(`${status} ${statusText}${timeStr}`),
    )

    if (headers && Object.keys(headers).length > 0) {
      process.stderr.write(
        chalk.gray('  Headers:\n') + this.formatObject(headers, 4),
      )
    }

    if (body !== undefined) {
      const bodyStr = this.formatData(body, 4)
      // Truncate very long responses
      const lines = bodyStr.split('\n')
      if (lines.length > 50) {
        const truncated = lines.slice(0, 50).join('\n')
        process.stderr.write(
          `${chalk.gray('  Body (truncated):\n')}${truncated}\n${chalk.gray(`    ... ${lines.length - 50} more lines ...\n`)}`,
        )
      } else {
        process.stderr.write(`${chalk.gray('  Body:\n')}${bodyStr}`)
      }
    }
  }

  /**
   * Format configuration resolution details
   */
  formatConfigResolution(
    serviceName: string,
    configPath: string,
    isGlobal: boolean,
  ): void {
    if (!this.enabled) return

    const scope = isGlobal ? 'global' : 'local'
    this.debug(
      'CONFIG',
      `Loading service '${serviceName}' from ${scope} config`,
      { path: configPath },
    )
  }

  /**
   * Format parameter mapping details
   */
  formatParameterMapping(
    endpoint: string,
    rawParams: Record<string, unknown>,
    mappedParams: {
      path?: Record<string, string>
      query?: Record<string, string | string[]>
      headers?: Record<string, string>
      body?: unknown
    },
  ): void {
    if (!this.enabled) return

    this.debug(
      'PARAMS',
      `Mapping parameters for endpoint '${endpoint}'`,
    )

    if (Object.keys(rawParams).length > 0) {
      process.stderr.write(
        chalk.gray('  Raw parameters:\n') +
          this.formatObject(rawParams, 4),
      )
    }

    process.stderr.write(
      chalk.gray('  Mapped parameters:\n') +
        this.formatObject(mappedParams, 4),
    )
  }

  /**
   * Format environment variable resolution
   */
  formatEnvResolution(
    varName: string,
    resolved: boolean,
    value?: string,
  ): void {
    if (!this.enabled) return

    if (resolved) {
      const maskedValue = value
        ? '*'.repeat(Math.min(value.length, 8))
        : ''
      this.debug('ENV', `Resolved ${varName} = ${maskedValue}`)
    } else {
      this.debug('ENV', `Warning: ${varName} is not set`)
    }
  }

  /**
   * Format cache information
   */
  formatCacheInfo(
    endpoint: string,
    cacheKey: string,
    hit: boolean,
    ttl?: number,
  ): void {
    if (!this.enabled) return

    const status = hit ? chalk.green('HIT') : chalk.yellow('MISS')
    let message = `Cache ${status} for endpoint '${endpoint}'`
    if (ttl !== undefined) {
      message += ` (TTL: ${ttl}s)`
    }

    this.debug('CACHE', message, { key: cacheKey })
  }

  /**
   * Output info message
   */
  info(message: string): void {
    if (!this.enabled) return
    this.debug('INFO', message)
  }

  /**
   * Output warning message
   */
  warning(message: string): void {
    if (!this.enabled) return
    this.debug('WARN', chalk.yellow(message))
  }

  /**
   * Format data for output
   */
  private formatData(data: unknown, indent: number = 2): string {
    if (data === undefined || data === null) {
      return chalk.gray(`${' '.repeat(indent)}${String(data)}\n`)
    }

    if (typeof data === 'string') {
      return chalk.gray(`${' '.repeat(indent)}${data}\n`)
    }

    if (typeof data === 'object') {
      return this.formatObject(
        data as Record<string, unknown>,
        indent,
      )
    }

    return chalk.gray(`${' '.repeat(indent)}${String(data)}\n`)
  }

  /**
   * Format an object for output
   */
  private formatObject(
    obj: Record<string, unknown>,
    indent: number = 2,
  ): string {
    try {
      const json = JSON.stringify(obj, null, 2)
      return `${json
        .split('\n')
        .map(line => `${' '.repeat(indent)}${chalk.gray(line)}`)
        .join('\n')}\n`
    } catch {
      return chalk.gray(
        `${' '.repeat(indent)}[Circular or non-serializable object]\n`,
      )
    }
  }
}
