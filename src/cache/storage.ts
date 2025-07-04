import flatCache from 'flat-cache'
import path from 'path'
import os from 'os'
import { createHash } from 'crypto'
import { OvrmndError, ErrorCode } from '../utils/error'

export interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  ttl: number
}

export class CacheStorage {
  private cache: flatCache.Cache
  private cacheDir: string

  constructor(cacheDir?: string) {
    this.cacheDir =
      cacheDir ?? path.join(os.homedir(), '.ovrmnd', 'cache')
    this.cache = flatCache.load('api-responses', this.cacheDir)
  }

  /**
   * Generate a cache key from service, endpoint, and parameters
   */
  generateKey(
    serviceName: string,
    endpointName: string,
    url: string,
    headers?: Record<string, string>,
  ): string {
    // Sort headers to ensure consistent key generation
    const sortedHeaders = headers
      ? this.sortObject(this.sanitizeHeaders(headers))
      : {}

    const hashInput = {
      service: serviceName,
      endpoint: endpointName,
      url,
      headers: sortedHeaders,
    }

    const hash = createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex')
      .substring(0, 16)

    return `${serviceName}.${endpointName}.${hash}`
  }

  /**
   * Sort object keys for consistent hashing
   */
  private sortObject(
    obj: Record<string, string>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {}
    const keys = Object.keys(obj).sort()
    for (const key of keys) {
      const value = obj[key]
      if (value !== undefined) {
        sorted[key] = value
      }
    }
    return sorted
  }

  /**
   * Remove sensitive headers before hashing
   */
  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {}
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie']

    // Copy non-sensitive headers with lowercase keys
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase()
      if (!sensitiveHeaders.includes(lowerKey)) {
        sanitized[lowerKey] = value
      }
    }

    return sanitized
  }

  /**
   * Get a cached response if it exists and is not expired
   */
  get<T = unknown>(key: string): T | null {
    try {
      const entry = this.cache.getKey(key) as
        | CacheEntry<T>
        | undefined

      if (!entry) {
        return null
      }

      const now = Date.now()
      const age = (now - entry.timestamp) / 1000 // age in seconds

      if (age > entry.ttl) {
        // Entry has expired
        this.cache.removeKey(key)
        this.cache.save(true)
        return null
      }

      return entry.data
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.CACHE_READ_ERROR,
        message: `Failed to read from cache: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  /**
   * Store a response in the cache
   */
  set<T = unknown>(key: string, data: T, ttl: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      }

      this.cache.setKey(key, entry)
      this.cache.save(true)
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.CACHE_WRITE_ERROR,
        message: `Failed to write to cache: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    try {
      this.cache.destroy()
      this.cache = flatCache.load('api-responses', this.cacheDir)
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.CACHE_WRITE_ERROR,
        message: `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  /**
   * Clear cache for a specific service or endpoint
   */
  clearPattern(pattern: string): number {
    try {
      const keys = this.cache.keys()
      let cleared = 0

      for (const key of keys) {
        if (key.startsWith(pattern)) {
          this.cache.removeKey(key)
          cleared++
        }
      }

      if (cleared > 0) {
        this.cache.save(true)
      }

      return cleared
    } catch (error) {
      throw new OvrmndError({
        code: ErrorCode.CACHE_WRITE_ERROR,
        message: `Failed to clear cache pattern: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; totalSize: number } {
    const keys = this.cache.keys()
    let totalSize = 0

    for (const key of keys) {
      const entry = this.cache.getKey(key) as CacheEntry | undefined
      if (entry) {
        totalSize += JSON.stringify(entry).length
      }
    }

    return {
      totalEntries: keys.length,
      totalSize,
    }
  }

  /**
   * Get all cache entries with metadata
   */
  getAllEntries(): Array<{
    key: string
    age: number
    ttl: number
    expired: boolean
    size: number
  }> {
    const keys = this.cache.keys()
    const now = Date.now()
    const entries = []

    for (const key of keys) {
      const entry = this.cache.getKey(key) as CacheEntry | undefined
      if (entry) {
        const age = Math.floor((now - entry.timestamp) / 1000)
        const size = JSON.stringify(entry).length

        entries.push({
          key,
          age,
          ttl: entry.ttl,
          expired: age > entry.ttl,
          size,
        })
      }
    }

    return entries
  }
}
