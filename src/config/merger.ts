import type {
  ConfigFile,
  MergedConfig,
  ServiceConfig,
} from '../types/config'
import logger from '../utils/logger'

/**
 * Merge service configurations (local overrides global)
 */
export function mergeConfigs(
  globalConfigs: ConfigFile[],
  localConfigs: ConfigFile[],
): MergedConfig {
  const services = new Map<string, ServiceConfig>()

  // First, add all global configs
  for (const configFile of globalConfigs) {
    const { serviceName } = configFile.config
    services.set(serviceName, configFile.config)
    logger.debug(`Added global config for service: ${serviceName}`)
  }

  // Then, override with local configs
  for (const configFile of localConfigs) {
    const { serviceName } = configFile.config
    if (services.has(serviceName)) {
      logger.debug(
        `Overriding global config with local config for service: ${serviceName}`,
      )
    } else {
      logger.debug(`Added local config for service: ${serviceName}`)
    }
    services.set(serviceName, configFile.config)
  }

  return {
    services,
    globalConfigs,
    localConfigs,
  }
}

/**
 * Deep merge two objects (used for future complex merging scenarios)
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (
        sourceValue !== undefined &&
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== undefined &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>]
      } else if (sourceValue !== undefined) {
        // Override with source value
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    }
  }

  return result
}
