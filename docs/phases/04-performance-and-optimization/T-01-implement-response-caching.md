# Task: Implement Response Caching

## Overview

Build a file-based caching system for GET request responses with TTL-based expiration to reduce redundant API calls and improve performance.

## Requirements

1. **Cache Storage**
   - File-based persistent cache
   - Organized directory structure
   - Automatic cleanup of expired entries
   - Size limits to prevent disk bloat

2. **Cache Key Generation**
   - Unique keys from request parameters
   - Deterministic and collision-free
   - Include relevant headers in key

3. **TTL Management**
   - Per-endpoint TTL configuration
   - Check expiration on read
   - Clean expired entries periodically

4. **Cache Operations**
   - Get with expiration check
   - Set with TTL
   - Delete specific entries
   - Clear by pattern

## Implementation Steps

### 1. Cache Storage Implementation
```typescript
// src/cache/storage.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { CacheEntry, CacheMetadata, CacheStats } from '@types';
import { createLogger } from '@utils/logger';
import { ensureDir, fileExists } from '@utils/file-system';

const logger = createLogger('cache-storage');

export class FileCacheStorage {
  private cacheDir: string;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timer | null = null;
  
  constructor(cacheDir: string = '~/.ovrmnd/cache', maxSize: number = 100 * 1024 * 1024) {
    this.cacheDir = this.expandPath(cacheDir);
    this.maxSize = maxSize;
    this.startCleanupTimer();
  }
  
  private expandPath(dir: string): string {
    return dir.replace(/^~/, process.env.HOME || '');
  }
  
  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        logger.error('Cache cleanup failed', err);
      });
    }, 60 * 60 * 1000);
  }
  
  async initialize(): Promise<void> {
    await ensureDir(this.cacheDir);
    await ensureDir(path.join(this.cacheDir, 'entries'));
    await ensureDir(path.join(this.cacheDir, 'meta'));
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const entryPath = this.getEntryPath(key);
      const metaPath = this.getMetaPath(key);
      
      if (!await fileExists(entryPath) || !await fileExists(metaPath)) {
        return null;
      }
      
      const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      
      // Check if expired
      const now = Date.now();
      const expiresAt = meta.timestamp + (meta.ttl * 1000);
      
      if (now > expiresAt) {
        logger.debug('Cache entry expired', { key, expiresAt: new Date(expiresAt) });
        await this.delete(key);
        return null;
      }
      
      const data = await fs.readFile(entryPath, 'utf-8');
      return JSON.parse(data);
      
    } catch (error) {
      logger.error('Cache read error', { key, error });
      return null;
    }
  }
  
  async set<T>(
    key: string,
    data: T,
    ttl: number,
    metadata?: CacheMetadata
  ): Promise<void> {
    try {
      const entryPath = this.getEntryPath(key);
      const metaPath = this.getMetaPath(key);
      
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
        metadata,
      };
      
      // Write data and metadata separately
      await fs.writeFile(entryPath, JSON.stringify(data, null, 2));
      await fs.writeFile(metaPath, JSON.stringify(entry, null, 2));
      
      logger.debug('Cache entry written', { key, ttl });
      
      // Check size limits
      await this.enforceMaxSize();
      
    } catch (error) {
      logger.error('Cache write error', { key, error });
      throw error;
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      const entryPath = this.getEntryPath(key);
      const metaPath = this.getMetaPath(key);
      
      await Promise.all([
        fs.unlink(entryPath).catch(() => {}),
        fs.unlink(metaPath).catch(() => {}),
      ]);
      
      logger.debug('Cache entry deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }
  
  async clear(pattern?: string): Promise<number> {
    let count = 0;
    
    try {
      const metaFiles = await fs.readdir(path.join(this.cacheDir, 'meta'));
      
      for (const file of metaFiles) {
        if (!file.endsWith('.json')) continue;
        
        const metaPath = path.join(this.cacheDir, 'meta', file);
        const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        
        // Check pattern match
        if (pattern && meta.metadata) {
          const matchPattern = new RegExp(pattern);
          const identifier = `${meta.metadata.service}.${meta.metadata.endpoint}`;
          
          if (!matchPattern.test(identifier)) {
            continue;
          }
        }
        
        await this.delete(meta.key);
        count++;
      }
      
      logger.info('Cache cleared', { pattern, count });
      return count;
      
    } catch (error) {
      logger.error('Cache clear error', { pattern, error });
      return count;
    }
  }
  
  async stats(): Promise<CacheStats> {
    try {
      const metaFiles = await fs.readdir(path.join(this.cacheDir, 'meta'));
      let totalSize = 0;
      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;
      
      for (const file of metaFiles) {
        const metaPath = path.join(this.cacheDir, 'meta', file);
        const entryPath = path.join(this.cacheDir, 'entries', file);
        
        const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        const stat = await fs.stat(entryPath);
        
        totalSize += stat.size;
        
        const entryDate = new Date(meta.timestamp);
        if (!oldestEntry || entryDate < oldestEntry) {
          oldestEntry = entryDate;
        }
        if (!newestEntry || entryDate > newestEntry) {
          newestEntry = entryDate;
        }
      }
      
      return {
        totalEntries: metaFiles.length,
        totalSize,
        oldestEntry,
        newestEntry,
      };
      
    } catch (error) {
      logger.error('Cache stats error', error);
      return {
        totalEntries: 0,
        totalSize: 0,
      };
    }
  }
  
  private async cleanup(): Promise<void> {
    logger.debug('Running cache cleanup');
    
    const metaFiles = await fs.readdir(path.join(this.cacheDir, 'meta'));
    let removedCount = 0;
    
    for (const file of metaFiles) {
      try {
        const metaPath = path.join(this.cacheDir, 'meta', file);
        const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        
        const now = Date.now();
        const expiresAt = meta.timestamp + (meta.ttl * 1000);
        
        if (now > expiresAt) {
          await this.delete(meta.key);
          removedCount++;
        }
      } catch (error) {
        logger.error('Cleanup error for file', { file, error });
      }
    }
    
    if (removedCount > 0) {
      logger.info('Cache cleanup completed', { removed: removedCount });
    }
  }
  
  private async enforceMaxSize(): Promise<void> {
    const stats = await this.stats();
    
    if (stats.totalSize <= this.maxSize) {
      return;
    }
    
    logger.warn('Cache size exceeded, removing oldest entries', {
      currentSize: stats.totalSize,
      maxSize: this.maxSize,
    });
    
    // Get all entries sorted by timestamp
    const entries: Array<{ key: string; timestamp: number; size: number }> = [];
    const metaFiles = await fs.readdir(path.join(this.cacheDir, 'meta'));
    
    for (const file of metaFiles) {
      const metaPath = path.join(this.cacheDir, 'meta', file);
      const entryPath = path.join(this.cacheDir, 'entries', file);
      
      const meta: CacheEntry = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      const stat = await fs.stat(entryPath);
      
      entries.push({
        key: meta.key,
        timestamp: meta.timestamp,
        size: stat.size,
      });
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until under limit
    let currentSize = stats.totalSize;
    for (const entry of entries) {
      if (currentSize <= this.maxSize) break;
      
      await this.delete(entry.key);
      currentSize -= entry.size;
    }
  }
  
  private getEntryPath(key: string): string {
    const filename = this.hashKey(key) + '.json';
    return path.join(this.cacheDir, 'entries', filename);
  }
  
  private getMetaPath(key: string): string {
    const filename = this.hashKey(key) + '.json';
    return path.join(this.cacheDir, 'meta', filename);
  }
  
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
```

### 2. Cache Key Generator
```typescript
// src/cache/key-generator.ts
import * as crypto from 'crypto';
import { ApiRequest } from '@types';

export class CacheKeyGenerator {
  static generate(
    service: string,
    endpoint: string,
    request: ApiRequest,
    includeHeaders: string[] = []
  ): string {
    const keyParts = {
      service,
      endpoint,
      method: request.method,
      url: request.url,
      headers: {},
    };
    
    // Include specific headers in cache key
    if (includeHeaders.length > 0) {
      includeHeaders.forEach(header => {
        const value = request.headers[header.toLowerCase()];
        if (value) {
          keyParts.headers[header] = value;
        }
      });
    }
    
    // Create deterministic string representation
    const keyString = JSON.stringify(keyParts, Object.keys(keyParts).sort());
    
    // Generate hash
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
  
  static generateFromParts(parts: Record<string, any>): string {
    // Sort keys for deterministic output
    const sortedParts = Object.keys(parts)
      .sort()
      .reduce((acc, key) => {
        acc[key] = parts[key];
        return acc;
      }, {} as Record<string, any>);
    
    const keyString = JSON.stringify(sortedParts);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
}
```

### 3. Cache Manager
```typescript
// src/cache/manager.ts
import { FileCacheStorage } from './storage';
import { CacheKeyGenerator } from './key-generator';
import { ApiRequest, ApiResponse, CacheMetadata } from '@types';
import { createLogger } from '@utils/logger';
import { CacheDebugger } from './debug';

const logger = createLogger('cache-manager');

export class CacheManager {
  private storage: FileCacheStorage;
  private enabled: boolean;
  
  constructor(enabled: boolean = true, cacheDir?: string) {
    this.enabled = enabled;
    this.storage = new FileCacheStorage(cacheDir);
  }
  
  async initialize(): Promise<void> {
    if (this.enabled) {
      await this.storage.initialize();
      logger.info('Cache initialized');
    }
  }
  
  async get<T>(
    service: string,
    endpoint: string,
    request: ApiRequest
  ): Promise<ApiResponse<T> | null> {
    if (!this.enabled) return null;
    
    const key = CacheKeyGenerator.generate(service, endpoint, request);
    CacheDebugger.logCacheCheck(key, false);
    
    const cached = await this.storage.get<T>(key);
    
    if (cached) {
      CacheDebugger.logCacheCheck(key, true);
      
      return {
        success: true,
        data: cached,
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          cached: true,
          cacheKey: key,
        },
      };
    }
    
    return null;
  }
  
  async set<T>(
    service: string,
    endpoint: string,
    request: ApiRequest,
    response: ApiResponse<T>,
    ttl: number
  ): Promise<void> {
    if (!this.enabled || ttl <= 0) return;
    
    const key = CacheKeyGenerator.generate(service, endpoint, request);
    
    const metadata: CacheMetadata = {
      url: request.url,
      method: request.method,
      service,
      endpoint,
    };
    
    await this.storage.set(response.data, ttl, metadata);
    
    const size = JSON.stringify(response.data).length;
    CacheDebugger.logCacheWrite(key, ttl, size);
  }
  
  async clear(pattern?: string): Promise<number> {
    const count = await this.storage.clear(pattern);
    CacheDebugger.logCacheClear(pattern, count);
    return count;
  }
  
  async stats(): Promise<any> {
    return this.storage.stats();
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('Cache enabled:', enabled);
  }
  
  destroy(): void {
    this.storage.destroy();
  }
}

// Singleton instance
let cacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}
```

### 4. Integration with API Client
```typescript
// src/api/client.ts (partial)
export class ApiClient {
  private cacheManager: CacheManager;
  
  constructor() {
    this.cacheManager = getCacheManager();
  }
  
  async execute(
    context: RequestContext
  ): Promise<ApiResponse> {
    const { service, endpoint, options } = context;
    
    // Check cache for GET requests
    if (endpoint.method === 'GET' && !options.noCache && endpoint.cacheTTL) {
      const cached = await this.cacheManager.get(
        service.serviceName,
        endpoint.name,
        request
      );
      
      if (cached) {
        return cached;
      }
    }
    
    // Make actual request
    const response = await this.makeRequest(request);
    
    // Cache successful GET responses
    if (
      endpoint.method === 'GET' &&
      response.success &&
      endpoint.cacheTTL &&
      !options.noCache
    ) {
      await this.cacheManager.set(
        service.serviceName,
        endpoint.name,
        request,
        response,
        endpoint.cacheTTL
      );
    }
    
    return response;
  }
}
```

## Testing Strategy

1. **Storage Tests**
   - Test read/write operations
   - Test expiration handling
   - Test size limit enforcement
   - Test cleanup process

2. **Key Generation Tests**
   - Test deterministic keys
   - Test with different parameters
   - Test header inclusion

3. **Integration Tests**
   - Test caching in API flow
   - Test cache hits and misses
   - Test TTL expiration

## Success Criteria

- [ ] GET responses are cached according to TTL
- [ ] Expired entries are not returned
- [ ] Cache size limits are enforced
- [ ] Cache keys are deterministic
- [ ] Cleanup runs periodically
- [ ] Cache can be disabled with --no-cache

## Common Issues

1. **File System Permissions**: Handle permission errors gracefully
2. **Disk Space**: Monitor and limit cache size
3. **Concurrent Access**: Handle multiple processes safely
4. **Key Collisions**: Use strong hashing algorithm