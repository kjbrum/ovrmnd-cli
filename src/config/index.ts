/**
 * Main configuration module that exports all config-related functionality
 */

export * from './yaml-parser'
export * from './discovery'
export * from './merger'
export * from './env-resolver'
export * from './validator'

import { discoverConfigs } from './discovery'
import { mergeConfigs } from './merger'
import { resolveServiceConfig } from './env-resolver'
import { findServiceConfig } from './discovery'
import type {
  ServiceConfig,
  ResolvedServiceConfig,
} from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'

/**
 * Load and resolve a service configuration by name
 */
export async function loadServiceConfig(
  serviceName: string,
): Promise<ResolvedServiceConfig> {
  const config = await findServiceConfig(serviceName)

  if (!config) {
    throw new OvrmndError({
      code: ErrorCode.SERVICE_NOT_FOUND,
      message: `Service '${serviceName}' not found. Run 'ovrmnd list services' to see available services.`,
    })
  }

  return resolveServiceConfig(config)
}

/**
 * Get all available services with their configurations
 */
export async function getAllServices(): Promise<
  Map<string, ServiceConfig>
> {
  const { global, local } = await discoverConfigs()
  const merged = mergeConfigs(global, local)
  return merged.services
}
