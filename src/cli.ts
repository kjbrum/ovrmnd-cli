#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { config as loadEnv } from 'dotenv'
import { createLogger } from './utils/logger'
import { handleError } from './utils/error'
import { readFileSync } from 'fs'
import path from 'path'
import { CallCommand } from './commands/call'

const logger = createLogger('cli')

// Get package info for version
const packagePath = path.join(__dirname, '../package.json')
const packageJson = JSON.parse(
  readFileSync(packagePath, 'utf-8'),
) as {
  name: string
  version: string
  description: string
}

async function main(): Promise<void> {
  try {
    // Load environment variables
    loadEnv()

    // Configure yargs
    const argv = await yargs(hideBin(process.argv))
      .scriptName('ovrmnd')
      .usage(
        `
        ${packageJson.name} (v${packageJson.version})
        ${packageJson.description}

        Usage: $0 <command> [options]`,
      )
      .command(new CallCommand())
      .demandCommand(1, 'You need at least one command')
      .recommendCommands()
      .strict()
      .help('h')
      .alias('h', 'help')
      .version(packageJson.version)
      .alias('v', 'version')
      .wrap(yargs.terminalWidth())
      .epilogue(
        'For more information, visit https://github.com/kjbrum/ovrmnd-cli',
      )
      .fail((msg, err, yargs) => {
        if (err) {
          handleError(err)
        } else {
          console.error(msg)
          console.error('\n')
          yargs.showHelp()
        }
        process.exit(1)
      })
      .parse()

    logger.debug('CLI initialized', { argv })
  } catch (error) {
    handleError(error)
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', error)
  handleError(error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise })
  handleError(new Error(`Unhandled rejection: ${String(reason)}`))
  process.exit(1)
})

// Run the CLI
void main()
