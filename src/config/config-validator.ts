import * as yaml from 'js-yaml'
import * as fs from 'fs/promises'
import type {
  ServiceConfig,
  EndpointConfig,
  AliasConfig,
} from '../types/config'
import { OvrmndError } from '../utils/error'
import {
  validateServiceConfig,
  extractPathParameters,
} from './validator'
import type {
  ValidationResult,
  ValidationIssue,
} from '../commands/validate'

export interface ValidatorOptions {
  strict?: boolean
  checkEnvVars?: boolean
}

export class ConfigValidator {
  private options: ValidatorOptions

  constructor(options: ValidatorOptions = {}) {
    this.options = options
  }

  async validateFile(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      file: filePath,
      valid: true,
      errors: [],
      warnings: [],
    }

    try {
      // Read file
      const content = await fs.readFile(filePath, 'utf-8')

      // Parse YAML with line tracking
      let config: unknown
      try {
        config = yaml.load(content, {
          filename: filePath,
        })
      } catch (yamlError) {
        result.valid = false
        const error = yamlError as Error & {
          mark?: { line?: number; snippet?: string }
        }
        const errorIssue: ValidationIssue = {
          message: `YAML syntax error: ${error.message}`,
        }
        if (error.mark?.line !== undefined) {
          errorIssue.line = error.mark.line + 1 // YAML line numbers are 0-based
        }
        if (error.mark?.snippet) {
          errorIssue.context = error.mark.snippet
        }
        result.errors.push(errorIssue)
        return result
      }

      // Schema validation using existing validator
      try {
        const validConfig = validateServiceConfig(config, filePath)

        // Semantic validation
        this.validateSemantics(validConfig, result)
      } catch (error) {
        result.valid = false
        if (error instanceof OvrmndError) {
          // Parse validation errors from the message
          const lines = error.message.split('\n')
          const mainMessage = lines[0]
          if (mainMessage) {
            result.errors.push({
              message: mainMessage,
            })
          }

          // Extract individual validation errors
          for (let i = 1; i < lines.length; i++) {
            const lineText = lines[i]
            if (lineText && lineText.trim().startsWith('- ')) {
              result.errors.push({
                message: lineText.trim().substring(2),
              })
            }
          }
        } else {
          result.errors.push({
            message: String(error),
          })
        }
      }
    } catch (error) {
      result.valid = false
      result.errors.push({
        message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      })
    }

    return result
  }

  async validateFiles(
    filePaths: string[],
  ): Promise<ValidationResult[]> {
    return Promise.all(filePaths.map(file => this.validateFile(file)))
  }

  private validateSemantics(
    config: ServiceConfig,
    result: ValidationResult,
  ): void {
    try {
      // Check authentication configuration
      this.validateAuthentication(config, result)

      // Check endpoints
      if (config.endpoints) {
        config.endpoints.forEach(endpoint => {
          this.validateEndpoint(endpoint, result)
        })
      }

      // Check aliases
      if (config.aliases && config.endpoints) {
        this.validateAliases(config.aliases, config.endpoints, result)
      }

      // Check for duplicate endpoint/alias names
      this.checkDuplicateNames(config, result)

      // Check for environment variables
      if (this.options.checkEnvVars) {
        this.checkEnvironmentVariables(config, result)
      }

      // Check URL format
      this.validateBaseUrl(config.baseUrl, result)
    } catch (error) {
      throw error
    }
  }

  private validateAuthentication(
    config: ServiceConfig,
    result: ValidationResult,
  ): void {
    if (!config.authentication) {
      result.warnings.push({
        message:
          'No authentication configured. API calls may fail if authentication is required.',
        suggestion:
          'Add authentication section with type: bearer or apikey',
      })
      return
    }

    const auth = config.authentication

    if (auth.type === 'bearer' && !auth.token) {
      result.errors.push({
        message: 'Bearer authentication requires a token field',
        suggestion:
          'Add "token: ${YOUR_API_TOKEN}" to authentication',
      })
    }

    if (auth.type === 'apikey') {
      if (!auth.token) {
        result.errors.push({
          message: 'API Key authentication requires a token field',
          suggestion:
            'Add "token: ${YOUR_API_KEY}" to authentication',
        })
      }
      if (!auth.header) {
        result.warnings.push({
          message:
            'API Key authentication without header field will use default header "X-API-Key"',
          suggestion:
            'Add "header: Your-Header-Name" to specify custom header',
        })
      }
    }
  }

  private validateEndpoint(
    endpoint: EndpointConfig,
    result: ValidationResult,
  ): void {
    // Skip if endpoint is missing required fields
    if (!endpoint.path) {
      return
    }

    // Extract path parameters
    const pathParams = extractPathParameters(endpoint.path)
    const pathParamSet = new Set(pathParams)

    // Check for invalid path format
    if (!endpoint.path.startsWith('/')) {
      result.warnings.push({
        message: `Endpoint '${endpoint.name}' path should start with '/'`,
        context: `Path: ${endpoint.path}`,
        suggestion: `Change to: /${endpoint.path}`,
      })
    }

    // Check for duplicate path parameters
    const duplicateParams = pathParams.filter(
      (param, index) => pathParams.indexOf(param) !== index,
    )
    if (duplicateParams.length > 0) {
      result.errors.push({
        message: `Duplicate path parameters in endpoint '${endpoint.name}': ${duplicateParams.join(', ')}`,
        context: `Path: ${endpoint.path}`,
      })
    }

    // Validate HTTP method specific rules
    if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
      if (endpoint.defaultParams) {
        const bodyParams = Object.entries(
          endpoint.defaultParams,
        ).filter(([key]) => !pathParamSet.has(key))

        if (bodyParams.length > 0) {
          result.warnings.push({
            message: `${endpoint.method} endpoint '${endpoint.name}' has defaultParams that will be sent as query parameters`,
            context: `Parameters: ${bodyParams.map(([k]) => k).join(', ')}`,
            suggestion:
              'Ensure these are intended as query parameters',
          })
        }
      }
    }

    // Check cache TTL
    if (endpoint.cacheTTL !== undefined) {
      if (endpoint.method !== 'GET') {
        result.warnings.push({
          message: `Cache TTL on non-GET endpoint '${endpoint.name}' will be ignored`,
          context: `Method: ${endpoint.method}`,
          suggestion: 'Remove cacheTTL or change method to GET',
        })
      }
      if (endpoint.cacheTTL <= 0) {
        result.errors.push({
          message: `Invalid cache TTL for endpoint '${endpoint.name}': must be positive`,
          context: `cacheTTL: ${endpoint.cacheTTL}`,
        })
      }
    }

    // Check for common header issues
    if (endpoint.headers) {
      Object.entries(endpoint.headers).forEach(([key]) => {
        if (
          key.toLowerCase() === 'content-type' &&
          endpoint.method === 'GET'
        ) {
          result.warnings.push({
            message: `Content-Type header on GET endpoint '${endpoint.name}' is unusual`,
            suggestion:
              'Remove Content-Type header from GET requests',
          })
        }
        if (
          key.toLowerCase() === 'authorization' ||
          key.toLowerCase() === 'x-api-key'
        ) {
          result.warnings.push({
            message: `Authentication header in endpoint '${endpoint.name}' headers`,
            context: `Header: ${key}`,
            suggestion:
              'Use authentication section instead of hardcoding auth headers',
          })
        }
      })
    }
  }

  private validateAliases(
    aliases: AliasConfig[],
    endpoints: EndpointConfig[],
    result: ValidationResult,
  ): void {
    const endpointNames = new Set(endpoints.map(e => e.name))

    aliases.forEach(alias => {
      if (!endpointNames.has(alias.endpoint)) {
        result.errors.push({
          message: `Alias '${alias.name}' references unknown endpoint '${alias.endpoint}'`,
          suggestion: `Available endpoints: ${Array.from(endpointNames).join(', ')}`,
        })
      }

      // Check if alias args satisfy endpoint requirements
      const endpoint = endpoints.find(e => e.name === alias.endpoint)
      if (endpoint?.path) {
        const pathParams = extractPathParameters(endpoint.path)
        const missingParams = pathParams.filter(
          param => !alias.args || !(param in alias.args),
        )

        if (missingParams.length > 0) {
          result.warnings.push({
            message: `Alias '${alias.name}' missing required path parameters`,
            context: `Missing: ${missingParams.join(', ')}`,
            suggestion:
              'Add missing parameters to args or provide them at runtime',
          })
        }
      }
    })
  }

  private checkDuplicateNames(
    config: ServiceConfig,
    result: ValidationResult,
  ): void {
    const allNames = new Set<string>()

    // Check endpoint names
    if (config.endpoints) {
      config.endpoints.forEach(endpoint => {
        if (allNames.has(endpoint.name)) {
          result.errors.push({
            message: `Duplicate name '${endpoint.name}' found in endpoints`,
            suggestion:
              'Use unique names for all endpoints and aliases',
          })
        }
        allNames.add(endpoint.name)
      })
    }

    // Check alias names
    if (config.aliases) {
      config.aliases.forEach(alias => {
        if (allNames.has(alias.name)) {
          result.errors.push({
            message: `Duplicate name '${alias.name}' found (conflicts with endpoint or another alias)`,
            suggestion:
              'Use unique names for all endpoints and aliases',
          })
        }
        allNames.add(alias.name)
      })
    }
  }

  private checkEnvironmentVariables(
    config: ServiceConfig,
    result: ValidationResult,
  ): void {
    const envVarRegex = /\$\{([^}]+)\}/g
    const configStr = JSON.stringify(config)
    const checkedVars = new Set<string>()

    let match
    while ((match = envVarRegex.exec(configStr)) !== null) {
      const varName = match[1]
      if (varName && !checkedVars.has(varName)) {
        checkedVars.add(varName)
        if (!process.env[varName]) {
          result.warnings.push({
            message: `Environment variable '${varName}' is not set`,
            suggestion: `Set ${varName} in your environment or .env file`,
          })
        }
      }
    }
  }

  private validateBaseUrl(
    baseUrl: string,
    result: ValidationResult,
  ): void {
    // Skip validation if it's an environment variable
    if (!baseUrl || baseUrl.match(/^\$\{[^}]+\}$/)) {
      return
    }

    // Check for common issues
    if (baseUrl.endsWith('/')) {
      result.warnings.push({
        message: 'Base URL ends with a slash',
        context: `URL: ${baseUrl}`,
        suggestion: 'Remove trailing slash from baseUrl',
      })
    }

    if (
      baseUrl &&
      !baseUrl.startsWith('http://') &&
      !baseUrl.startsWith('https://')
    ) {
      result.errors.push({
        message: 'Base URL must start with http:// or https://',
        context: `URL: ${baseUrl}`,
      })
    }

    // Check for localhost in production
    if (
      baseUrl.includes('localhost') ||
      baseUrl.includes('127.0.0.1')
    ) {
      result.warnings.push({
        message: 'Base URL points to localhost',
        context: `URL: ${baseUrl}`,
        suggestion:
          'Ensure this is intended for local development only',
      })
    }
  }
}
