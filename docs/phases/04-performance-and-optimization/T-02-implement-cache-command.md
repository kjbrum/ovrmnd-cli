# Task: Implement Cache Command

## Overview

Create the `cache` command to provide cache management capabilities including clearing cache entries and viewing cache statistics.

## Requirements

1. **Cache Clear**
   - Clear all cache entries
   - Clear by service name
   - Clear by service.endpoint pattern
   - Confirmation for destructive operations

2. **Cache Statistics**
   - Total entries and size
   - Oldest/newest entries
   - Breakdown by service
   - Cache hit rate (if tracked)

3. **Cache Inspection**
   - List cached endpoints
   - Show cache metadata
   - Display TTL remaining

4. **Output Formatting**
   - Human-readable tables
   - JSON output for automation
   - Clear success/failure messages

## Implementation Steps

### 1. Cache Command Structure
```typescript
// src/commands/cache.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';
import { getCacheManager } from '@cache/manager';
import { OutputFormatter } from '@utils/output';
import { createLogger } from '@utils/logger';
import * as prompts from 'prompts';

const logger = createLogger('cache-command');

interface CacheArgs {
  action: 'clear' | 'stats' | 'list';
  target?: string;
  force?: boolean;
  json?: boolean;
  verbose?: boolean;
}

export class CacheCommand extends BaseCommand<CacheArgs> {
  command = 'cache <action> [target]';
  describe = 'Manage response cache';
  
  builder(yargs: Argv): Argv<CacheArgs> {
    return yargs
      .positional('action', {
        describe: 'Cache action to perform',
        type: 'string',
        choices: ['clear', 'stats', 'list'],
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
      .example('$0 cache clear', 'Clear all cache entries')
      .example('$0 cache clear github', 'Clear GitHub service cache')
      .example('$0 cache clear github.get-user', 'Clear specific endpoint cache')
      .example('$0 cache stats', 'Show cache statistics')
      .example('$0 cache list', 'List cached endpoints');
  }
  
  async handler(args: Arguments<CacheArgs>): Promise<void> {
    try {
      const formatter = new OutputFormatter(args.json);
      const cacheManager = getCacheManager();
      
      await cacheManager.initialize();
      
      switch (args.action) {
        case 'clear':
          await this.handleClear(args, formatter);
          break;
        case 'stats':
          await this.handleStats(args, formatter);
          break;
        case 'list':
          await this.handleList(args, formatter);
          break;
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private async handleClear(
    args: CacheArgs,
    formatter: OutputFormatter
  ): Promise<void> {
    const target = args.target;
    let pattern: string | undefined;
    let message: string;
    
    if (target) {
      pattern = target.replace('.', '\\.');
      message = `Clear cache for ${target}?`;
    } else {
      message = 'Clear ALL cache entries?';
    }
    
    // Confirm unless forced
    if (!args.force && !args.json) {
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message,
        initial: false,
      });
      
      if (!response.confirm) {
        console.log(formatter.info('Cache clear cancelled'));
        return;
      }
    }
    
    const count = await cacheManager.clear(pattern);
    
    if (formatter.isJson()) {
      console.log(formatter.format({
        action: 'clear',
        target: target || 'all',
        cleared: count,
        success: true,
      }));
    } else {
      if (count > 0) {
        console.log(formatter.success(`Cleared ${count} cache entries`));
      } else {
        console.log(formatter.info('No cache entries to clear'));
      }
    }
  }
  
  private async handleStats(
    args: CacheArgs,
    formatter: OutputFormatter
  ): Promise<void> {
    const stats = await cacheManager.getDetailedStats();
    
    if (formatter.isJson()) {
      console.log(formatter.format(stats));
      return;
    }
    
    console.log('\nCache Statistics:\n');
    console.log(`Total entries: ${stats.totalEntries}`);
    console.log(`Total size: ${this.formatBytes(stats.totalSize)}`);
    
    if (stats.oldestEntry) {
      console.log(`Oldest entry: ${stats.oldestEntry.toLocaleString()}`);
    }
    if (stats.newestEntry) {
      console.log(`Newest entry: ${stats.newestEntry.toLocaleString()}`);
    }
    
    if (args.verbose && stats.byService) {
      console.log('\nBy Service:');
      const serviceTable = Object.entries(stats.byService).map(([service, data]) => ({
        service,
        entries: data.entries,
        size: this.formatBytes(data.size),
        percentage: `${((data.size / stats.totalSize) * 100).toFixed(1)}%`,
      }));
      
      console.log(formatter.table(serviceTable, {
        columns: ['service', 'entries', 'size', 'percentage'],
        headers: {
          service: 'Service',
          entries: 'Entries',
          size: 'Size',
          percentage: '% of Total',
        },
      }));
    }
    
    if (stats.hitRate !== undefined) {
      console.log(`\nCache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    }
  }
  
  private async handleList(
    args: CacheArgs,
    formatter: OutputFormatter
  ): Promise<void> {
    const entries = await cacheManager.listEntries(args.target);
    
    if (formatter.isJson()) {
      console.log(formatter.format({ entries }));
      return;
    }
    
    if (entries.length === 0) {
      console.log(formatter.info('No cached entries found'));
      return;
    }
    
    console.log(`\nCached entries${args.target ? ` for ${args.target}` : ''}:\n`);
    
    if (args.verbose) {
      // Detailed view
      entries.forEach(entry => {
        console.log(`${entry.service}.${entry.endpoint}`);
        console.log(`  URL: ${entry.url}`);
        console.log(`  Cached: ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`  Expires: ${new Date(entry.expiresAt).toLocaleString()}`);
        console.log(`  TTL remaining: ${this.formatDuration(entry.ttlRemaining)}`);
        console.log(`  Size: ${this.formatBytes(entry.size)}`);
        console.log();
      });
    } else {
      // Table view
      const tableData = entries.map(entry => ({
        endpoint: `${entry.service}.${entry.endpoint}`,
        cached: this.formatRelativeTime(entry.timestamp),
        expires: this.formatRelativeTime(entry.expiresAt),
        size: this.formatBytes(entry.size),
      }));
      
      console.log(formatter.table(tableData, {
        columns: ['endpoint', 'cached', 'expires', 'size'],
        headers: {
          endpoint: 'Endpoint',
          cached: 'Cached',
          expires: 'Expires',
          size: 'Size',
        },
      }));
    }
    
    console.log(`\nTotal: ${entries.length} entries`);
  }
  
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  private formatDuration(ms: number): string {
    if (ms < 0) return 'expired';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
  
  private formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = timestamp - now;
    const absDiff = Math.abs(diff);
    
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let relative: string;
    if (days > 0) {
      relative = `${days}d`;
    } else if (hours > 0) {
      relative = `${hours}h`;
    } else if (minutes > 0) {
      relative = `${minutes}m`;
    } else {
      relative = 'now';
    }
    
    return diff < 0 ? `${relative} ago` : `in ${relative}`;
  }
}
```

### 2. Enhanced Cache Manager
```typescript
// src/cache/manager.ts (additions)
export interface CacheEntryInfo {
  service: string;
  endpoint: string;
  url: string;
  timestamp: number;
  expiresAt: number;
  ttlRemaining: number;
  size: number;
}

export interface DetailedCacheStats extends CacheStats {
  byService?: Record<string, { entries: number; size: number }>;
  hitRate?: number;
}

export class CacheManager {
  // ... existing code ...
  
  async getDetailedStats(): Promise<DetailedCacheStats> {
    const stats = await this.storage.stats();
    const entries = await this.storage.getAllMetadata();
    
    // Calculate stats by service
    const byService: Record<string, { entries: number; size: number }> = {};
    
    for (const entry of entries) {
      if (entry.metadata?.service) {
        const service = entry.metadata.service;
        if (!byService[service]) {
          byService[service] = { entries: 0, size: 0 };
        }
        byService[service].entries++;
        byService[service].size += entry.size || 0;
      }
    }
    
    // Calculate hit rate if tracking is enabled
    const hitRate = this.calculateHitRate();
    
    return {
      ...stats,
      byService,
      hitRate,
    };
  }
  
  async listEntries(pattern?: string): Promise<CacheEntryInfo[]> {
    const entries = await this.storage.getAllMetadata();
    const now = Date.now();
    
    return entries
      .filter(entry => {
        if (!pattern) return true;
        
        const identifier = `${entry.metadata?.service}.${entry.metadata?.endpoint}`;
        return identifier.includes(pattern);
      })
      .map(entry => ({
        service: entry.metadata?.service || 'unknown',
        endpoint: entry.metadata?.endpoint || 'unknown',
        url: entry.metadata?.url || '',
        timestamp: entry.timestamp,
        expiresAt: entry.timestamp + (entry.ttl * 1000),
        ttlRemaining: (entry.timestamp + (entry.ttl * 1000)) - now,
        size: entry.size || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  private calculateHitRate(): number | undefined {
    // This would require tracking hits/misses
    // For now, return undefined
    return undefined;
  }
}
```

### 3. Output Formatter Enhancement
```typescript
// src/utils/output.ts (additions)
export class OutputFormatter {
  // ... existing code ...
  
  success(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ success: true, message });
    }
    return chalk.green(`✓ ${message}`);
  }
  
  warning(message: string): string {
    if (this.jsonMode) {
      return JSON.stringify({ warning: message });
    }
    return chalk.yellow(`⚠ ${message}`);
  }
}
```

### 4. Storage Enhancement
```typescript
// src/cache/storage.ts (additions)
export class FileCacheStorage {
  // ... existing code ...
  
  async getAllMetadata(): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];
    
    try {
      const metaFiles = await fs.readdir(path.join(this.cacheDir, 'meta'));
      
      for (const file of metaFiles) {
        if (!file.endsWith('.json')) continue;
        
        const metaPath = path.join(this.cacheDir, 'meta', file);
        const entryPath = path.join(this.cacheDir, 'entries', file);
        
        try {
          const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          const stat = await fs.stat(entryPath);
          meta.size = stat.size;
          entries.push(meta);
        } catch (error) {
          // Skip corrupted entries
          logger.warn('Skipping corrupted cache entry', { file, error });
        }
      }
    } catch (error) {
      logger.error('Failed to read metadata', error);
    }
    
    return entries;
  }
}
```

## Testing Strategy

1. **Command Tests**
   - Test clear with different patterns
   - Test stats calculation
   - Test list filtering
   - Test force flag

2. **Formatting Tests**
   - Test human-readable output
   - Test JSON output
   - Test empty cache scenarios

3. **Integration Tests**
   - Test with actual cache data
   - Test confirmation prompts
   - Test error handling

## Success Criteria

- [ ] Can clear all cache entries
- [ ] Can clear by service or endpoint
- [ ] Shows accurate statistics
- [ ] Lists cached entries with metadata
- [ ] Confirmation prompts work (unless forced)
- [ ] JSON output mode functions correctly

## Dependencies

```bash
npm install prompts
npm install --save-dev @types/prompts
```

## Common Issues

1. **Large Cache**: Pagination for list command
2. **Confirmation**: Handle non-TTY environments
3. **Pattern Matching**: Clear regex documentation
4. **Performance**: Efficient stats calculation