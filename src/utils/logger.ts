import winston from 'winston'
import chalk from 'chalk'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
}

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
}

winston.addColors(LOG_COLORS)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, ...meta }) => {
      const colorizedLevel = winston.format
        .colorize()
        .colorize(level, level.toUpperCase())
      const contextStr = context
        ? chalk.gray(`[${String(context)}]`)
        : ''
      const metaStr = Object.keys(meta).length
        ? chalk.gray(JSON.stringify(meta))
        : ''
      return `${chalk.gray(
        String(timestamp),
      )} ${colorizedLevel} ${contextStr} ${String(message)} ${metaStr}`
    },
  ),
)

// File format for production logs
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// Ensure log directory exists
const LOG_DIR = path.join(process.cwd(), 'logs')
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true })
}

// Create the logger
const logger = winston.createLogger({
  level:
    process.env['LOG_LEVEL'] ??
    (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  levels: LOG_LEVELS,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env['NODE_ENV'] === 'test',
    }),
  ],
})

// Add file transport in production
if (process.env['NODE_ENV'] === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
  )

  logger.add(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
    }),
  )
}

export function createLogger(context: string): winston.Logger {
  return logger.child({ context })
}

export { logger as default }
