import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'
import type { ConfigFile, ServiceConfig } from '../types/config'
import { loadYamlConfig } from './yaml-parser'
import logger from '../utils/logger'

/**
 * Get the global configuration directory
 */
export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), '.ovrmnd')
}

/**
 * Get the local configuration directory
 */
export function getLocalConfigDir(): string {
  return path.join(process.cwd(), '.ovrmnd')
}

/**
 * Discover YAML configuration files in a directory
 */
async function discoverConfigsInDir(
  dir: string,
  isGlobal: boolean,
): Promise<ConfigFile[]> {
  const configs: ConfigFile[] = []

  try {
    const files = await fs.readdir(dir)
    const yamlFiles = files.filter(
      file => file.endsWith('.yaml') || file.endsWith('.yml'),
    )

    for (const file of yamlFiles) {
      const filePath = path.join(dir, file)
      try {
        const config = await loadYamlConfig(filePath)
        configs.push({
          path: filePath,
          config,
          isGlobal,
        })
        logger.debug(
          `Loaded config: ${filePath} (service: ${config.serviceName})`,
        )
      } catch (error) {
        logger.error(`Failed to load config ${filePath}:`, error)
        // Continue loading other configs
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(`Error reading config directory ${dir}:`, error)
    }
  }

  return configs
}

/**
 * Discover all configuration files (global and local)
 */
export async function discoverConfigs(): Promise<{
  global: ConfigFile[]
  local: ConfigFile[]
}> {
  const [globalConfigs, localConfigs] = await Promise.all([
    discoverConfigsInDir(getGlobalConfigDir(), true),
    discoverConfigsInDir(getLocalConfigDir(), false),
  ])

  logger.debug(
    `Discovered ${globalConfigs.length} global and ${localConfigs.length} local configs`,
  )

  return {
    global: globalConfigs,
    local: localConfigs,
  }
}

/**
 * Find a specific service configuration by name
 */
export async function findServiceConfig(
  serviceName: string,
): Promise<ServiceConfig | null> {
  const { global, local } = await discoverConfigs()

  // Check local configs first (they take precedence)
  for (const configFile of local) {
    if (configFile.config.serviceName === serviceName) {
      logger.debug(
        `Found service ${serviceName} in local config: ${configFile.path}`,
      )
      return configFile.config
    }
  }

  // Then check global configs
  for (const configFile of global) {
    if (configFile.config.serviceName === serviceName) {
      logger.debug(
        `Found service ${serviceName} in global config: ${configFile.path}`,
      )
      return configFile.config
    }
  }

  return null
}

/**
 * Get all available service names
 */
export async function getAvailableServices(): Promise<string[]> {
  const { global, local } = await discoverConfigs()
  const serviceNames = new Set<string>()

  // Add all service names (local configs override global)
  for (const configFile of [...global, ...local]) {
    serviceNames.add(configFile.config.serviceName)
  }

  return Array.from(serviceNames).sort()
}

/**
 * Load all service configurations
 */
export async function loadAllConfigs(
  configDir?: string,
): Promise<Map<string, ServiceConfig>> {
  // If a specific config directory is provided, use only that
  if (configDir) {
    const configs = await discoverConfigsInDir(configDir, false)
    const serviceMap = new Map<string, ServiceConfig>()

    for (const configFile of configs) {
      serviceMap.set(configFile.config.serviceName, configFile.config)
    }

    return serviceMap
  }

  // Otherwise, use standard discovery
  const { global, local } = await discoverConfigs()
  const serviceMap = new Map<string, ServiceConfig>()

  // Add global configs first
  for (const configFile of global) {
    serviceMap.set(configFile.config.serviceName, configFile.config)
  }

  // Override with local configs
  for (const configFile of local) {
    serviceMap.set(configFile.config.serviceName, configFile.config)
  }

  return serviceMap
}

/**
 * ConfigDiscovery class for backward compatibility
 */
export class ConfigDiscovery {
  async loadAll(
    configDir?: string,
  ): Promise<Map<string, ServiceConfig>> {
    return loadAllConfigs(configDir)
  }
}
