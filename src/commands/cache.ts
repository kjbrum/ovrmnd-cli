import type { Argv, Arguments } from 'yargs'
import prompts from 'prompts'
import { BaseCommand } from './base-command'
import { CacheStorage } from '../cache/storage'
import { OutputFormatter } from '../utils/output'

interface CacheArgs {
  action: 'clear' | 'stats' | 'list'
  target?: string
  force?: boolean
  pretty?: boolean
  verbose?: boolean
  debug?: boolean
}

interface CacheEntryInfo {
  service: string
  endpoint: string
  url: string
  key: string
  timestamp: number
  expiresAt: number
  ttlRemaining: number
  size: number
  expired: boolean
}

interface DetailedCacheStats {
  totalEntries: number
  totalSize: number
  oldestEntry?: Date | undefined
  newestEntry?: Date | undefined
  byService: Record<string, { entries: number; size: number }>
}

export class CacheCommand extends BaseCommand<CacheArgs> {
  command = 'cache <action> [target]'
  describe = 'Manage response cache'

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  builder(yargs: Argv): Argv<CacheArgs> {
    return yargs
      .positional('action', {
        describe: 'Cache action to perform',
        type: 'string',
        choices: ['clear', 'stats', 'list'] as const,
        demandOption: true,
      })
      .positional('target', {
        describe: 'Service or service.endpoint to target',
        type: 'string',
      })
      .option('force', {
        alias: 'f',
        describe: 'Skip confirmation prompts',
        type: 'boolean',
        default: false,
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show detailed information',
        type: 'boolean',
        default: false,
      })
      .option('pretty', {
        describe: 'Output in human-readable format',
        type: 'boolean',
        default: false,
      })
      .option('debug', {
        describe: 'Enable debug mode',
        type: 'boolean',
        default: false,
        hidden: true,
      })
      .example('$0 cache clear', 'Clear all cache entries')
      .example('$0 cache clear github', 'Clear GitHub service cache')
      .example(
        '$0 cache clear github.listRepos',
        'Clear specific endpoint cache',
      )
      .example('$0 cache stats', 'Show cache statistics')
      .example(
        '$0 cache list',
        'List cached endpoints',
      ) as unknown as Argv<CacheArgs>
  }

  async handler(args: Arguments<CacheArgs>): Promise<void> {
    const formatter = new OutputFormatter(!args.pretty)
    const cacheStorage = new CacheStorage()

    try {
      switch (args.action) {
        case 'clear':
          await this.handleClear(args, formatter, cacheStorage)
          break
        case 'stats':
          this.handleStats(args, formatter, cacheStorage)
          break
        case 'list':
          this.handleList(args, formatter, cacheStorage)
          break
      }
    } catch (error) {
      const errorOutput = formatter.formatError(error)
      if (formatter.isJsonMode) {
        process.stdout.write(`${errorOutput}\n`)
      } else {
        process.stderr.write(`${errorOutput}\n`)
      }
      process.exit(1)
    }
  }

  private async handleClear(
    args: CacheArgs,
    formatter: OutputFormatter,
    cacheStorage: CacheStorage,
  ): Promise<void> {
    const target = args.target
    let pattern: string | undefined
    let message: string

    if (target) {
      pattern = target
      message = `Clear cache for ${target}?`
    } else {
      message = 'Clear ALL cache entries?'
    }

    // Confirm unless forced or in JSON mode
    if (!args.force && !formatter.isJsonMode) {
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message,
        initial: false,
      })

      if (!response.confirm) {
        console.error(formatter.warning('Cache clear cancelled'))
        return
      }
    }

    let count: number
    if (pattern) {
      count = cacheStorage.clearPattern(pattern)
    } else {
      // Get count before clearing for accurate reporting
      const stats = cacheStorage.getStats()
      count = stats.totalEntries
      cacheStorage.clear()
    }

    if (formatter.isJsonMode) {
      process.stdout.write(
        `${formatter.format({
          action: 'clear',
          target: target ?? 'all',
          cleared: count,
          success: true,
        })}\n`,
      )
    } else {
      if (count > 0) {
        console.error(
          formatter.success(`Cleared ${count} cache entries`),
        )
      } else {
        console.error(formatter.warning('No cache entries to clear'))
      }
    }
  }

  private handleStats(
    args: CacheArgs,
    formatter: OutputFormatter,
    cacheStorage: CacheStorage,
  ): void {
    const stats = this.getDetailedStats(cacheStorage)

    if (formatter.isJsonMode) {
      process.stdout.write(`${formatter.format(stats)}\n`)
      return
    }

    console.error(formatter.success('Cache Statistics:\n'))
    console.error(`Total entries: ${stats.totalEntries}`)
    console.error(`Total size: ${this.formatBytes(stats.totalSize)}`)

    if (stats.oldestEntry) {
      console.error(
        `Oldest entry: ${stats.oldestEntry.toLocaleString()}`,
      )
    }
    if (stats.newestEntry) {
      console.error(
        `Newest entry: ${stats.newestEntry.toLocaleString()}`,
      )
    }

    if (args.verbose && stats.totalEntries > 0) {
      console.error('\nBy Service:')
      const headers = ['Service', 'Entries', 'Size', '% of Total']
      const rows = Object.entries(stats.byService).map(
        ([service, data]) => [
          service,
          data.entries.toString(),
          this.formatBytes(data.size),
          `${((data.size / stats.totalSize) * 100).toFixed(1)}%`,
        ],
      )

      console.error(formatter.table(headers, rows))
    }
  }

  private handleList(
    args: CacheArgs,
    formatter: OutputFormatter,
    cacheStorage: CacheStorage,
  ): void {
    const entries = this.getCacheEntries(cacheStorage, args.target)

    if (formatter.isJsonMode) {
      process.stdout.write(`${formatter.format({ entries })}\n`)
      return
    }

    if (entries.length === 0) {
      console.error(formatter.warning('No cached entries found'))
      return
    }

    console.error(
      formatter.success(
        `Cached entries${args.target ? ` for ${args.target}` : ''}:\n`,
      ),
    )

    if (args.verbose) {
      // Detailed view
      entries.forEach(entry => {
        console.error(`${entry.service}.${entry.endpoint}`)
        console.error(`  Key: ${entry.key}`)
        console.error(`  URL: ${entry.url}`)
        console.error(
          `  Cached: ${new Date(entry.timestamp).toLocaleString()}`,
        )
        console.error(
          `  Expires: ${new Date(entry.expiresAt).toLocaleString()}`,
        )
        console.error(
          `  TTL remaining: ${this.formatDuration(entry.ttlRemaining)}`,
        )
        console.error(`  Size: ${this.formatBytes(entry.size)}`)
        console.error(
          `  Status: ${entry.expired ? 'Expired' : 'Valid'}`,
        )
        console.error()
      })
    } else {
      // Table view
      const headers = ['Endpoint', 'Cached', 'Expires', 'Size']
      const rows = entries.map(entry => [
        `${entry.service}.${entry.endpoint}`,
        this.formatRelativeTime(entry.timestamp),
        this.formatRelativeTime(entry.expiresAt),
        this.formatBytes(entry.size),
      ])

      console.error(formatter.table(headers, rows))
    }

    console.error(`\nTotal: ${entries.length} entries`)
  }

  private getDetailedStats(
    cacheStorage: CacheStorage,
  ): DetailedCacheStats {
    const stats = cacheStorage.getStats()
    const entries = cacheStorage.getAllEntries()

    const byService: Record<
      string,
      { entries: number; size: number }
    > = {}
    let oldestTimestamp: number | undefined
    let newestTimestamp: number | undefined

    for (const entry of entries) {
      // Parse service and endpoint from key
      const parts = entry.key.split('.')
      const service = parts[0] ?? 'unknown'

      if (!byService[service]) {
        byService[service] = { entries: 0, size: 0 }
      }
      byService[service].entries++
      byService[service].size += entry.size

      // We'll calculate timestamps from the age
      const entryTimestamp = Date.now() - entry.age * 1000
      if (!oldestTimestamp || entryTimestamp < oldestTimestamp) {
        oldestTimestamp = entryTimestamp
      }
      if (!newestTimestamp || entryTimestamp > newestTimestamp) {
        newestTimestamp = entryTimestamp
      }
    }

    return {
      totalEntries: stats.totalEntries,
      totalSize: stats.totalSize,
      oldestEntry: oldestTimestamp
        ? new Date(oldestTimestamp)
        : undefined,
      newestEntry: newestTimestamp
        ? new Date(newestTimestamp)
        : undefined,
      byService,
    }
  }

  private getCacheEntries(
    cacheStorage: CacheStorage,
    target?: string,
  ): CacheEntryInfo[] {
    const entries = cacheStorage.getAllEntries()
    const now = Date.now()
    const result: CacheEntryInfo[] = []

    for (const entry of entries) {
      // Parse service and endpoint from key
      const parts = entry.key.split('.')
      let service = parts[0] ?? 'unknown'
      let endpoint = parts[1] ?? 'unknown'
      const identifier = `${service}.${endpoint}`

      // Filter by target if provided
      if (target && !identifier.includes(target)) {
        continue
      }

      // Get the actual cache entry to extract metadata
      const cacheEntry = cacheStorage.getRawEntry(entry.key)
      if (!cacheEntry) continue

      const timestamp = cacheEntry.timestamp || now
      const ttl = cacheEntry.ttl || 0
      const expiresAt = timestamp + ttl * 1000
      const url = cacheEntry.metadata?.url ?? 'unknown'

      // Override service/endpoint if we have metadata
      if (cacheEntry.metadata?.service) {
        service = cacheEntry.metadata.service
      }
      if (cacheEntry.metadata?.endpoint) {
        endpoint = cacheEntry.metadata.endpoint
      }

      result.push({
        service,
        endpoint,
        url,
        key: entry.key,
        timestamp,
        expiresAt,
        ttlRemaining: Math.max(0, expiresAt - now),
        size: entry.size,
        expired: entry.expired,
      })
    }

    // Sort by timestamp, newest first
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  private formatDuration(ms: number): string {
    if (ms <= 0) return 'expired'

    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  private formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = timestamp - now
    const absDiff = Math.abs(diff)

    const minutes = Math.floor(absDiff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    let relative: string
    if (days > 0) {
      relative = `${days}d`
    } else if (hours > 0) {
      relative = `${hours}h`
    } else if (minutes > 0) {
      relative = `${minutes}m`
    } else {
      relative = 'now'
    }

    if (relative === 'now') {
      return 'now'
    }

    return diff < 0 ? `${relative} ago` : `in ${relative}`
  }
}
