import { existsSync, readdirSync } from 'fs'
import path from 'path'
import os from 'os'
import { createLogger } from './logger'

const logger = createLogger('config-utils')

export interface ConfigPaths {
  global: string
  local: string
  cache: string
}

export function getConfigPaths(): ConfigPaths {
  const homeDir = os.homedir()
  const cwd = process.cwd()

  return {
    global: path.join(homeDir, '.ovrmnd'),
    local: path.join(cwd, '.ovrmnd'),
    cache: path.join(homeDir, '.ovrmnd', 'cache'),
  }
}

export function findConfigFile(filename: string): string | null {
  const paths = getConfigPaths()

  // Check local directory first
  const localPath = path.join(paths.local, filename)
  if (existsSync(localPath)) {
    logger.debug('Found config file in local directory', {
      path: localPath,
    })
    return localPath
  }

  // Check global directory
  const globalPath = path.join(paths.global, filename)
  if (existsSync(globalPath)) {
    logger.debug('Found config file in global directory', {
      path: globalPath,
    })
    return globalPath
  }

  logger.debug('Config file not found', { filename })
  return null
}

export function getAllConfigFiles(
  extension: string = '.yaml',
): string[] {
  const paths = getConfigPaths()
  const configFiles: string[] = []

  // Helper function to get files from a directory
  const getFilesFromDir = (dir: string): string[] => {
    if (!existsSync(dir)) {
      return []
    }

    try {
      return readdirSync(dir)
        .filter(file => file.endsWith(extension))
        .map(file => path.join(dir, file))
    } catch (error) {
      logger.error('Failed to read directory', { dir, error })
      return []
    }
  }

  // Get files from local directory
  configFiles.push(...getFilesFromDir(paths.local))

  // Get files from global directory
  configFiles.push(...getFilesFromDir(paths.global))

  logger.debug('Found config files', {
    count: configFiles.length,
    files: configFiles,
  })
  return configFiles
}

export function resolveEnvVariables(value: string): string {
  // Replace ${ENV_VAR} patterns with actual environment variable values
  return value.replace(/\$\{([^}]+)\}/g, (match, envVar: string) => {
    const envValue = process.env[envVar]
    if (envValue === undefined) {
      logger.warn('Environment variable not found', {
        variable: envVar,
      })
      return match // Return original if not found
    }
    return envValue
  })
}

export function mergeConfigs<T extends Record<string, unknown>>(
  ...configs: Partial<T>[]
): T {
  const result = {} as T

  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value === undefined) continue

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof result[key as keyof T] === 'object' &&
        result[key as keyof T] !== null &&
        !Array.isArray(result[key as keyof T])
      ) {
        // Deep merge objects
        result[key as keyof T] = mergeConfigs(
          result[key as keyof T] as Record<string, unknown>,
          value as Record<string, unknown>,
        ) as T[keyof T]
      } else {
        // Direct assignment for primitives and arrays
        result[key as keyof T] = value as T[keyof T]
      }
    }
  }

  return result
}

export function validateRequired<T>(
  config: T,
  required: (keyof T)[],
): void {
  const missing: string[] = []

  for (const key of required) {
    if (
      config[key] === undefined ||
      config[key] === null ||
      config[key] === ''
    ) {
      missing.push(String(key))
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(', ')}`,
    )
  }
}
