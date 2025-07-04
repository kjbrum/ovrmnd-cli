import { BaseCommand } from './base-command'
import type { Argv, ArgumentsCamelCase } from 'yargs'
import { ConfigValidator } from '../config/config-validator'
import { OutputFormatter } from '../utils/output'
import { OvrmndError, ErrorCode } from '../utils/error'
import { DebugFormatter } from '../utils/debug'
import * as path from 'path'
import * as fs from 'fs/promises'
import {
  getGlobalConfigDir,
  getLocalConfigDir,
} from '../config/discovery'
import logger from '../utils/logger'

interface ValidateArgs {
  service?: string
  file?: string
  strict?: boolean
  pretty?: boolean
  config?: string
  debug?: boolean
}

export class ValidateCommand extends BaseCommand<ValidateArgs> {
  command = 'validate [service]'
  describe = 'Validate service configuration files'

  builder(yargs: Argv): Argv<ValidateArgs> {
    return yargs
      .positional('service', {
        describe:
          'Service name to validate (validates all if omitted)',
        type: 'string',
      })
      .option('file', {
        alias: 'f',
        describe: 'Validate a specific file',
        type: 'string',
      })
      .option('strict', {
        describe: 'Treat warnings as errors',
        type: 'boolean',
        default: false,
      })
      .option('pretty', {
        describe: 'Output in human-readable format',
        type: 'boolean',
        default: false,
      })
      .option('config', {
        describe: 'Path to config directory',
        type: 'string',
      })
      .option('debug', {
        describe: 'Enable debug output',
        type: 'boolean',
        default: false,
      })
      .example('$0 validate', 'Validate all service configs')
      .example('$0 validate github', 'Validate GitHub config')
      .example(
        '$0 validate -f ./my-service.yaml',
        'Validate specific file',
      ) as Argv<ValidateArgs>
  }

  handler = async (
    args: ArgumentsCamelCase<ValidateArgs>,
  ): Promise<void> => {
    const formatter = new OutputFormatter(!args.pretty)
    const debugFormatter = new DebugFormatter(args.debug ?? false)

    try {
      const validator = new ConfigValidator({
        strict: args.strict ?? false,
        checkEnvVars: true,
      })

      let results

      if (args.file) {
        // Validate a specific file
        if (debugFormatter.isEnabled) {
          debugFormatter.debug('VALIDATE', 'Validating specific file', {
            file: args.file,
          })
        }
        const result = await validator.validateFile(args.file)
        results = [result]
      } else {
        // Discover and validate config files
        if (debugFormatter.isEnabled) {
          debugFormatter.debug('VALIDATE', 'Discovering YAML files', {
            configDir: args.config ?? 'default directories',
          })
        }
        const files = await this.discoverYamlFiles(args.config)

        if (args.service) {
          // Filter files for the specific service
          const filtered = await this.filterByService(
            files,
            args.service,
          )
          if (filtered.length === 0) {
            throw new OvrmndError({
              code: ErrorCode.CONFIG_NOT_FOUND,
              message: `No configuration files found for service '${args.service}'`,
              help: 'Use "ovrmnd list services" to see available services',
            })
          }
          results = await validator.validateFiles(filtered)
        } else {
          // Validate all files
          results = await validator.validateFiles(files)
        }
      }

      // Display results
      this.displayResults(results, formatter, args.strict ?? false)

      // Exit with error code if validation failed
      const hasErrors = results.some(r => r.errors.length > 0)
      const hasWarnings = results.some(r => r.warnings.length > 0)

      if (hasErrors || (args.strict && hasWarnings)) {
        process.exit(1)
      }
    } catch (error) {
      const errorOutput = formatter.formatError(error)
      process.stderr.write(`${errorOutput}\n`)
      process.exit(1)
    }
  }

  private async discoverYamlFiles(
    configDir?: string,
  ): Promise<string[]> {
    const files: string[] = []

    if (configDir) {
      // Use specified directory
      await this.findYamlFilesInDir(configDir, files)
    } else {
      // Use standard directories
      await this.findYamlFilesInDir(getGlobalConfigDir(), files)
      await this.findYamlFilesInDir(getLocalConfigDir(), files)
    }

    return files
  }

  private async findYamlFilesInDir(
    dir: string,
    files: string[],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir)
      for (const entry of entries) {
        if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          files.push(path.join(dir, entry))
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip it
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(`Error reading directory ${dir}:`, error)
      }
    }
  }

  private async filterByService(
    files: string[],
    serviceName: string,
  ): Promise<string[]> {
    const filtered: string[] = []

    for (const file of files) {
      // First try by filename
      const basename = path.basename(file, path.extname(file))
      if (basename.toLowerCase() === serviceName.toLowerCase()) {
        filtered.push(file)
        continue
      }

      // Then peek into the file to check serviceName
      try {
        const content = await fs.readFile(file, 'utf-8')
        // Simple regex to find serviceName without full parsing
        const match = content.match(/^serviceName:\s*(.+)$/m)
        if (
          match?.[1] &&
          match[1].trim().toLowerCase() === serviceName.toLowerCase()
        ) {
          filtered.push(file)
        }
      } catch {
        // Skip files we can't read
      }
    }

    return filtered
  }

  private displayResults(
    results: ValidationResult[],
    formatter: OutputFormatter,
    strict: boolean,
  ): void {
    if (formatter.isJsonMode) {
      process.stdout.write(`${JSON.stringify({ results })}\n`)
      return
    }

    let totalErrors = 0
    let totalWarnings = 0

    results.forEach(result => {
      totalErrors += result.errors.length
      totalWarnings += result.warnings.length

      if (
        result.errors.length === 0 &&
        result.warnings.length === 0
      ) {
        process.stderr.write(
          `${formatter.success(`✓ ${result.file}: Valid`)}\n`,
        )
      } else {
        process.stderr.write(`\n${result.file}:\n`)

        result.errors.forEach(error => {
          process.stderr.write(
            `  ${formatter.formatError(`✖ Error: ${error.message}`)}\n`,
          )
          if (error.line) {
            process.stderr.write(
              `    Line ${error.line}: ${error.context}\n`,
            )
          }
          if (error.suggestion) {
            process.stderr.write(
              `${formatter.warning(
                `    Suggestion: ${error.suggestion}`,
              )}\n`,
            )
          }
        })

        result.warnings.forEach(warning => {
          const prefix = strict ? '✖' : '⚠'
          const formatMethod = strict
            ? (msg: string): string => formatter.formatError(msg)
            : (msg: string): string => formatter.warning(msg)
          process.stderr.write(
            `  ${formatMethod(`${prefix} Warning: ${warning.message}`)}\n`,
          )
          if (warning.line) {
            process.stderr.write(
              `    Line ${warning.line}: ${warning.context}\n`,
            )
          }
          if (warning.suggestion) {
            process.stderr.write(
              `    Suggestion: ${warning.suggestion}\n`,
            )
          }
        })
      }
    })

    process.stderr.write(`\n${formatter.table(['Summary'], [])}\n`)
    process.stderr.write(`  Files validated: ${results.length}\n`)
    process.stderr.write(`  Errors: ${totalErrors}\n`)
    process.stderr.write(`  Warnings: ${totalWarnings}\n`)

    if (totalErrors > 0) {
      process.stderr.write(
        `\n${formatter.formatError('✖ Validation failed')}\n`,
      )
    } else if (totalWarnings > 0 && strict) {
      process.stderr.write(
        `\n${formatter.formatError(
          '✖ Validation failed (strict mode)',
        )}\n`,
      )
    } else {
      process.stderr.write(
        `\n${formatter.success('✓ Validation passed')}\n`,
      )
    }
  }
}

// Export the ValidationResult interface for use in other files
export interface ValidationIssue {
  message: string
  line?: number
  context?: string
  suggestion?: string
}

export interface ValidationResult {
  file: string
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}
