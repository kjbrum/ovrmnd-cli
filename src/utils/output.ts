import chalk from 'chalk'
import type { ApiResponse } from '../types'
import type { JsonError } from '../types/error'
import { OvrmndError } from './error'

export class OutputFormatter {
  private jsonMode: boolean

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode
  }

  isJson(): boolean {
    return this.jsonMode
  }

  get isJsonMode(): boolean {
    return this.jsonMode
  }

  format(data: unknown): string {
    if (this.jsonMode) {
      return JSON.stringify(data, null, 2)
    }

    // For human-readable output, format based on data type
    if (typeof data === 'string') {
      return data
    }

    if (Array.isArray(data)) {
      return this.formatArray(data)
    }

    if (typeof data === 'object' && data !== null) {
      return this.formatObject(data as Record<string, unknown>)
    }

    return String(data)
  }

  error(message: string, details?: unknown): string {
    if (this.jsonMode) {
      return JSON.stringify({ error: message, details }, null, 2)
    }

    let output = chalk.red(`✗ ${message}`)
    if (details) {
      output += `\n${chalk.gray(JSON.stringify(details, null, 2))}`
    }
    return output
  }

  formatError(error: unknown): string {
    if (this.jsonMode) {
      if (error instanceof OvrmndError) {
        const jsonError: JsonError = error.toJsonError()
        return JSON.stringify(jsonError, null, 2)
      }
      return JSON.stringify(
        {
          error: {
            code: 'UNKNOWN_ERROR',
            message:
              error instanceof Error ? error.message : String(error),
          },
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      )
    }

    // Human-readable format
    if (error instanceof OvrmndError) {
      let output = chalk.red(`✗ [${error.code}] ${error.message}`)

      if (error.details) {
        output += `\n${chalk.gray('Details:')} ${JSON.stringify(error.details, null, 2)}`
      }

      if (error.help) {
        output += `\n${chalk.yellow('Help:')} ${error.help}`
      }

      if (error.statusCode) {
        output += `\n${chalk.gray('Status Code:')} ${error.statusCode}`
      }

      return output
    }

    return this.error(
      error instanceof Error ? error.message : String(error),
    )
  }

  success(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ success: true, message }, null, 2)
    }
    return chalk.green(`✓ ${message}`)
  }

  info(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ info: message }, null, 2)
    }
    return chalk.blue(`ℹ ${message}`)
  }

  warning(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ warning: message }, null, 2)
    }
    return chalk.yellow(`⚠ ${message}`)
  }

  dim(message: string): string {
    if (this.jsonMode) {
      return message
    }
    return chalk.gray(message)
  }

  formatApiResponse(response: ApiResponse): string {
    if (this.jsonMode) {
      // In JSON mode, output only the data or error
      if (response.success && response.data !== undefined) {
        return JSON.stringify(response.data, null, 2)
      } else if (response.error) {
        return JSON.stringify({ error: response.error }, null, 2)
      }
      return JSON.stringify(null)
    }

    // Human-readable format
    if (response.success && response.data !== undefined) {
      return this.format(response.data)
    } else if (response.error) {
      return this.error(
        response.error.message,
        response.error.details,
      )
    }

    return this.info('No data returned')
  }

  table(
    headersOrData: string[] | unknown[],
    rowsOrOptions?:
      | string[][]
      | {
          columns?: string[]
          headers?: Record<string, string>
        },
  ): string {
    // Support two call signatures:
    // 1. table(headers: string[], rows: string[][])
    // 2. table(data: unknown[], options?: {...})

    if (
      Array.isArray(headersOrData) &&
      headersOrData.every(h => typeof h === 'string')
    ) {
      // New signature: headers and rows
      return this.tableFromHeadersAndRows(
        headersOrData as string[],
        rowsOrOptions as string[][],
      )
    }

    // Original signature: data with options
    const data = headersOrData as unknown[]
    const options = rowsOrOptions as {
      columns?: string[]
      headers?: Record<string, string>
    }

    if (this.jsonMode) {
      return JSON.stringify(data, null, 2)
    }

    if (data.length === 0) {
      return 'No data'
    }

    // Get columns
    const columns =
      options?.columns ??
      Object.keys(data[0] as Record<string, unknown>)
    const headers = options?.headers ?? {}

    // Calculate column widths
    const widths: Record<string, number> = {}
    for (const col of columns) {
      widths[col] = (headers[col] ?? col).length
      for (const row of data) {
        const value = String(
          (row as Record<string, unknown>)[col] || '',
        )
        widths[col] = Math.max(widths[col] || 0, value.length)
      }
    }

    // Build table
    const lines: string[] = []

    // Header
    const headerLine = columns
      .map(col => (headers[col] ?? col).padEnd(widths[col] ?? 0))
      .join(' │ ')
    lines.push(chalk.bold(headerLine))

    // Separator
    const separator = columns
      .map(col => '─'.repeat(widths[col] ?? 0))
      .join('─┼─')
    lines.push(separator)

    // Rows
    for (const row of data) {
      const rowLine = columns
        .map(col =>
          String((row as Record<string, unknown>)[col] ?? '').padEnd(
            widths[col] ?? 0,
          ),
        )
        .join(' │ ')
      lines.push(rowLine)
    }

    return lines.join('\n')
  }

  private tableFromHeadersAndRows(
    headers: string[],
    rows: string[][],
  ): string {
    if (rows.length === 0) {
      return 'No data'
    }

    // Calculate column widths
    const widths = headers.map((header, i) => {
      let maxWidth = header.length
      for (const row of rows) {
        const cellLength = (row[i] ?? '').length
        maxWidth = Math.max(maxWidth, cellLength)
      }
      return maxWidth
    })

    // Build table
    const lines: string[] = []

    // Header
    const headerLine = headers
      .map((header, i) => header.padEnd(widths[i] ?? 0))
      .join(' │ ')
    lines.push(chalk.bold(headerLine))

    // Separator
    const separator = widths
      .map(width => '─'.repeat(width))
      .join('─┼─')
    lines.push(separator)

    // Rows
    for (const row of rows) {
      const rowLine = row
        .map((cell, i) => (cell ?? '').padEnd(widths[i] ?? 0))
        .join(' │ ')
      lines.push(rowLine)
    }

    return lines.join('\n')
  }

  private formatArray(arr: unknown[]): string {
    if (arr.length === 0) {
      return '[]'
    }

    // Check if it's an array of objects with consistent structure
    if (
      typeof arr[0] === 'object' &&
      arr[0] !== null &&
      !Array.isArray(arr[0])
    ) {
      return this.table(arr)
    }

    // Simple array
    return arr
      .map((item, index) => `${index + 1}. ${this.format(item)}`)
      .join('\n')
  }

  private formatObject(obj: Record<string, unknown>): string {
    const lines: string[] = []

    for (const [key, value] of Object.entries(obj)) {
      const formattedKey = chalk.cyan(`${key}:`)

      if (typeof value === 'object' && value !== null) {
        lines.push(formattedKey)
        const formattedValue = this.format(value)
          .split('\n')
          .map(line => `  ${line}`)
          .join('\n')
        lines.push(formattedValue)
      } else {
        lines.push(`${formattedKey} ${this.format(value)}`)
      }
    }

    return lines.join('\n')
  }
}
