import type { Argv, ArgumentsCamelCase, CommandModule } from 'yargs'
import { handleError, OvrmndError, ErrorCode } from '../utils/error'
import { createLogger } from '../utils/logger'

export abstract class BaseCommand<T = unknown>
  implements CommandModule<unknown, T>
{
  abstract command: string
  abstract describe: string

  protected logger = createLogger(this.constructor.name)

  abstract builder(yargs: Argv): Argv<T>
  abstract handler(args: ArgumentsCamelCase<T>): Promise<void> | void

  protected handleError(error: unknown): void {
    handleError(error)
    process.exit(1)
  }

  protected validateArgs(
    args: ArgumentsCamelCase<T>,
    required: (keyof T)[],
  ): void {
    const missing: string[] = []
    const argsObj = args as unknown as Record<string, unknown>

    for (const key of required) {
      if (!argsObj[String(key)]) {
        missing.push(String(key))
      }
    }

    if (missing.length > 0) {
      throw new OvrmndError({
        code: ErrorCode.PARAM_REQUIRED,
        message: `Missing required arguments: ${missing.join(', ')}`,
      })
    }
  }
}
