import * as yaml from 'js-yaml'
import * as fs from 'fs/promises'
import type { ServiceConfig } from '../types/config'
import { OvrmndError, ErrorCode } from '../utils/error'
import logger from '../utils/logger'
import { validateServiceConfig } from './validator'

/**
 * Parse YAML content into ServiceConfig
 */
export function parseYaml(
  content: string,
  filePath: string,
): ServiceConfig {
  try {
    const parsed = yaml.load(content)

    if (!parsed || typeof parsed !== 'object') {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_INVALID,
        message: `Invalid YAML structure in ${filePath}`,
      })
    }

    // Use comprehensive validation
    return validateServiceConfig(parsed, filePath)
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_PARSE_ERROR,
        message: `YAML parsing error in ${filePath}: ${error.message}`,
      })
    }
    throw error
  }
}

/**
 * Load and parse a YAML configuration file
 */
export async function loadYamlConfig(
  filePath: string,
): Promise<ServiceConfig> {
  try {
    logger.debug(`Loading YAML config from: ${filePath}`)
    const content = await fs.readFile(filePath, 'utf-8')
    return parseYaml(content, filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new OvrmndError({
        code: ErrorCode.CONFIG_NOT_FOUND,
        message: `Configuration file not found: ${filePath}`,
      })
    }
    throw error
  }
}
