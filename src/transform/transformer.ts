import type { TransformConfig } from '../types/config'
import { createLogger } from '../utils/logger'

const logger = createLogger('ResponseTransformer')

export class ResponseTransformer {
  private config: TransformConfig

  constructor(config: TransformConfig) {
    this.config = config
  }

  transform(data: unknown): unknown {
    if (
      !this.config ||
      (!this.config.fields && !this.config.rename)
    ) {
      return data
    }

    try {
      let result = data

      // Apply field extraction first
      if (this.config.fields) {
        result = this.extractFields(result, this.config.fields)
      }

      // Apply renaming
      if (this.config.rename) {
        result = this.renameFields(result, this.config.rename)
      }

      return result
    } catch (error) {
      logger.error('Transform error, returning original data', error)
      return data
    }
  }

  private extractFields(data: unknown, fields: string[]): unknown {
    // Handle array of items
    if (Array.isArray(data)) {
      // Check if all fields are for array items (e.g., "[*].id", "[*].name")
      const arrayItemFields = fields
        .filter(f => f.startsWith('[*].'))
        .map(f => f.slice(4)) // Remove "[*]." prefix

      if (
        arrayItemFields.length > 0 &&
        arrayItemFields.length === fields.length
      ) {
        // All fields are array item fields, extract from each item
        return data.map(item =>
          this.extractFields(item, arrayItemFields),
        )
      }

      // Otherwise, apply fields to each item in the array
      return data.map(item => this.extractFields(item, fields))
    }

    // Must be an object to extract fields
    if (typeof data !== 'object' || data === null) {
      return data
    }

    const result: Record<string, unknown> = {}
    const dataObj = data as Record<string, unknown>

    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const value = this.getNestedValue(dataObj, field)
        if (value !== undefined) {
          this.setNestedValue(result, field, value)
        }
      } else if (field.includes('[*]')) {
        // Handle array operations
        const value = this.extractArrayField(dataObj, field)
        if (value !== undefined) {
          const key = field.split('[')[0]
          if (key) {
            result[key] = value
          }
        }
      } else {
        // Simple field extraction
        if (Object.prototype.hasOwnProperty.call(dataObj, field)) {
          result[field] = dataObj[field]
        }
      }
    }

    return result
  }

  private renameFields(
    data: unknown,
    rename: Record<string, string>,
  ): unknown {
    // Handle array of items
    if (Array.isArray(data)) {
      // Check if rename keys are for array items (e.g., "[*].username" -> "[*].handle")
      const arrayItemRenames: Record<string, string> = {}
      let hasArrayRenames = false

      for (const [oldPath, newPath] of Object.entries(rename)) {
        if (
          oldPath.startsWith('[*].') &&
          newPath.startsWith('[*].')
        ) {
          arrayItemRenames[oldPath.slice(4)] = newPath.slice(4)
          hasArrayRenames = true
        }
      }

      if (hasArrayRenames) {
        return data.map(item =>
          this.renameFields(item, arrayItemRenames),
        )
      }

      // Otherwise, apply renames to each item
      return data.map(item => this.renameFields(item, rename))
    }

    // Must be an object to rename fields
    if (typeof data !== 'object' || data === null) {
      return data
    }

    // Deep clone to avoid mutations
    const result = JSON.parse(JSON.stringify(data)) as Record<
      string,
      unknown
    >

    for (const [oldPath, newPath] of Object.entries(rename)) {
      if (oldPath.includes('.') || newPath.includes('.')) {
        // Handle nested renaming
        this.renameNestedField(result, oldPath, newPath)
      } else {
        // Simple rename
        if (Object.prototype.hasOwnProperty.call(result, oldPath)) {
          result[newPath] = result[oldPath]
          delete result[oldPath]
        }
      }
    }

    return result
  }

  private getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }

      if (typeof current !== 'object') {
        return undefined
      }

      const currentObj = current as Record<string, unknown>

      if (part.includes('[') && part.includes(']')) {
        // Handle array index
        const match = part.match(/^(.+?)\[(\d+)\]$/)
        if (!match) {
          return undefined
        }

        const [, arrayName, indexStr] = match
        const index = parseInt(indexStr!, 10)

        if (!arrayName) {
          return undefined
        }

        current = currentObj[arrayName]
        if (Array.isArray(current) && index < current.length) {
          current = current[index]
        } else {
          return undefined
        }
      } else {
        current = currentObj[part]
      }
    }

    return current
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.')
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!part) continue

      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    const lastPart = parts[parts.length - 1]
    if (lastPart) {
      current[lastPart] = value
    }
  }

  private extractArrayField(
    data: Record<string, unknown>,
    fieldPath: string,
  ): unknown {
    // Handle patterns like "items[*].name"
    const parts = fieldPath.split('[*].')
    const arrayPath = parts[0]
    if (!arrayPath) {
      return undefined
    }

    const array = this.getNestedValue(data, arrayPath)

    if (!Array.isArray(array)) {
      return undefined
    }

    if (parts.length === 1) {
      return array
    }

    const subPath = parts.slice(1).join('[*].')
    return array.map(item => {
      if (typeof item === 'object' && item !== null) {
        return this.getNestedValue(
          item as Record<string, unknown>,
          subPath,
        )
      }
      return undefined
    })
  }

  private renameNestedField(
    obj: Record<string, unknown>,
    oldPath: string,
    newPath: string,
  ): void {
    const value = this.getNestedValue(obj, oldPath)

    if (value !== undefined) {
      // Set new value
      this.setNestedValue(obj, newPath, value)

      // Delete old value
      this.deleteNestedValue(obj, oldPath)
    }
  }

  private deleteNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): void {
    const parts = path.split('.')
    let current: unknown = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!part) continue

      if (
        typeof current !== 'object' ||
        current === null ||
        !(part in current)
      ) {
        return
      }

      current = (current as Record<string, unknown>)[part]
    }

    const lastPart = parts[parts.length - 1]
    if (lastPart && typeof current === 'object' && current !== null) {
      delete (current as Record<string, unknown>)[lastPart]
    }
  }
}
