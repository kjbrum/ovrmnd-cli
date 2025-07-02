# Task: Debug Mode Enhancement

## Overview

Implement comprehensive debug mode that provides verbose logging for troubleshooting configuration issues, API calls, and general CLI behavior.

## Requirements

1. **Debug Output**
   - Request/response details
   - Configuration resolution process
   - Environment variable resolution
   - Cache hit/miss information
   - Performance timing

2. **Output Separation**
   - Debug output to stderr only
   - Regular output to stdout
   - Clean separation for piping

3. **Debug Levels**
   - Basic debug (--debug)
   - Verbose debug (--debug --verbose)
   - Namespace-specific debug (DEBUG=ovrmnd:*)

4. **Information Displayed**
   - HTTP request headers and body
   - Response status and headers
   - Config file paths loaded
   - Parameter mapping details
   - Error stack traces

## Implementation Steps

### 1. Debug Middleware
```typescript
// src/middleware/debug.ts
import { Arguments } from 'yargs';
import { createLogger } from '@utils/logger';
import debug from 'debug';

const logger = createLogger('debug-middleware');

export interface DebugContext {
  startTime: number;
  requestId: string;
  timings: Map<string, number>;
}

export function setupDebugMode(args: Arguments): DebugContext {
  const context: DebugContext = {
    startTime: Date.now(),
    requestId: generateRequestId(),
    timings: new Map(),
  };
  
  if (args.debug) {
    // Enable all ovrmnd namespaces
    debug.enable('ovrmnd:*');
    process.env.DEBUG = 'ovrmnd:*';
    
    if (args.verbose) {
      // Enable even more verbose logging
      process.env.DEBUG_VERBOSE = 'true';
    }
    
    logger.debug('Debug mode enabled', {
      requestId: context.requestId,
      args: sanitizeArgs(args),
    });
  }
  
  return context;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeArgs(args: Arguments): any {
  // Remove sensitive information from args before logging
  const sanitized = { ...args };
  const sensitiveKeys = ['token', 'password', 'secret', 'key'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}
```

### 2. HTTP Request Debugger
```typescript
// src/api/debug-interceptor.ts
import { ApiRequest, ApiResponse } from '@types';
import { createLogger } from '@utils/logger';
import { DebugContext } from '@middleware/debug';

const logger = createLogger('http');

export class HttpDebugger {
  private context: DebugContext;
  
  constructor(context: DebugContext) {
    this.context = context;
  }
  
  logRequest(request: ApiRequest): void {
    if (!process.env.DEBUG) return;
    
    const sanitizedHeaders = this.sanitizeHeaders(request.headers);
    
    logger.debug('HTTP Request', {
      requestId: this.context.requestId,
      method: request.method,
      url: request.url,
      headers: sanitizedHeaders,
    });
    
    if (request.body && process.env.DEBUG_VERBOSE) {
      logger.debug('Request Body', {
        requestId: this.context.requestId,
        body: this.sanitizeBody(request.body),
      });
    }
    
    this.context.timings.set('request_start', Date.now());
  }
  
  logResponse(response: ApiResponse, statusCode: number, headers: any): void {
    if (!process.env.DEBUG) return;
    
    const duration = Date.now() - (this.context.timings.get('request_start') || 0);
    
    logger.debug('HTTP Response', {
      requestId: this.context.requestId,
      statusCode,
      duration: `${duration}ms`,
      cached: response.metadata?.cached || false,
    });
    
    if (process.env.DEBUG_VERBOSE) {
      logger.debug('Response Headers', {
        requestId: this.context.requestId,
        headers: this.sanitizeHeaders(headers),
      });
      
      if (response.data) {
        logger.debug('Response Body Preview', {
          requestId: this.context.requestId,
          preview: this.truncateBody(response.data),
        });
      }
    }
  }
  
  logError(error: Error): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('HTTP Error', {
      requestId: this.context.requestId,
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.DEBUG_VERBOSE ? error.stack : undefined,
      },
    });
  }
  
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  private sanitizeBody(body: any): any {
    if (typeof body === 'string') {
      return body.length > 1000 ? body.substring(0, 1000) + '...[truncated]' : body;
    }
    
    // Deep clone and sanitize object
    const sanitized = JSON.parse(JSON.stringify(body));
    this.sanitizeObject(sanitized);
    return sanitized;
  }
  
  private sanitizeObject(obj: any): void {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      }
    }
  }
  
  private truncateBody(data: any): any {
    const str = JSON.stringify(data);
    if (str.length > 500) {
      return str.substring(0, 500) + '...[truncated]';
    }
    return data;
  }
}
```

### 3. Config Resolution Debugger
```typescript
// src/config/debug.ts
import { ServiceConfig } from '@types';
import { createLogger } from '@utils/logger';

const logger = createLogger('config');

export class ConfigDebugger {
  static logDiscovery(directories: string[], files: string[]): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Config discovery', {
      searchDirectories: directories,
      filesFound: files.length,
      files: process.env.DEBUG_VERBOSE ? files : undefined,
    });
  }
  
  static logConfigLoad(file: string, config: ServiceConfig): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Loading config', {
      file,
      serviceName: config.serviceName,
      endpoints: config.endpoints.length,
      aliases: config.aliases?.length || 0,
    });
  }
  
  static logEnvResolution(original: string, resolved: string, varName: string): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Environment variable resolution', {
      variable: varName,
      original,
      resolved: resolved || '[NOT FOUND]',
      exists: !!resolved,
    });
  }
  
  static logConfigMerge(global: ServiceConfig, local: ServiceConfig): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Config merge', {
      service: local.serviceName,
      source: 'local overrides global',
      globalFile: global.serviceName,
      localFile: local.serviceName,
    });
  }
  
  static logParameterMapping(
    endpoint: string,
    args: Record<string, any>,
    mapped: {
      path: Record<string, any>;
      query: Record<string, any>;
      body: Record<string, any>;
      headers: Record<string, any>;
    }
  ): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Parameter mapping', {
      endpoint,
      input: args,
      mapped: process.env.DEBUG_VERBOSE ? mapped : {
        pathParams: Object.keys(mapped.path),
        queryParams: Object.keys(mapped.query),
        bodyParams: Object.keys(mapped.body),
        headerParams: Object.keys(mapped.headers),
      },
    });
  }
}
```

### 4. Cache Debugger
```typescript
// src/cache/debug.ts
import { createLogger } from '@utils/logger';

const logger = createLogger('cache');

export class CacheDebugger {
  static logCacheCheck(key: string, found: boolean, ttl?: number): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Cache check', {
      key: process.env.DEBUG_VERBOSE ? key : key.substring(0, 32) + '...',
      hit: found,
      ttl: found ? ttl : undefined,
    });
  }
  
  static logCacheWrite(key: string, ttl: number, size: number): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Cache write', {
      key: process.env.DEBUG_VERBOSE ? key : key.substring(0, 32) + '...',
      ttl: `${ttl}s`,
      size: `${size} bytes`,
    });
  }
  
  static logCacheClear(pattern?: string, count?: number): void {
    if (!process.env.DEBUG) return;
    
    logger.debug('Cache clear', {
      pattern: pattern || 'all',
      cleared: count,
    });
  }
}
```

### 5. Integration with Commands
```typescript
// Example integration in call command
export class CallCommand extends BaseCommand<CallArgs> {
  async handler(args: Arguments<CallArgs>): Promise<void> {
    const debugContext = setupDebugMode(args);
    
    try {
      // ... command logic
      
      const httpDebugger = new HttpDebugger(debugContext);
      httpDebugger.logRequest(request);
      
      const response = await makeRequest(request);
      
      httpDebugger.logResponse(response, 200, responseHeaders);
      
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    } finally {
      if (process.env.DEBUG) {
        const totalTime = Date.now() - debugContext.startTime;
        logger.debug('Command completed', {
          requestId: debugContext.requestId,
          totalTime: `${totalTime}ms`,
        });
      }
    }
  }
}
```

### 6. Debug Output Format
```typescript
// src/utils/debug-formatter.ts
export class DebugFormatter {
  static format(namespace: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] DEBUG [${namespace}]`;
    
    let output = `${prefix} ${message}`;
    
    if (data) {
      if (process.env.DEBUG_VERBOSE) {
        output += '\n' + JSON.stringify(data, null, 2)
          .split('\n')
          .map(line => '  ' + line)
          .join('\n');
      } else {
        output += ' ' + JSON.stringify(data);
      }
    }
    
    return output;
  }
}
```

## Testing Strategy

1. **Debug Output Tests**
   - Verify debug messages appear with --debug
   - Verify they don't appear without --debug
   - Test stderr vs stdout separation

2. **Sanitization Tests**
   - Sensitive data is redacted
   - Headers are sanitized
   - Body content is sanitized

3. **Performance Tests**
   - Debug mode doesn't significantly slow down
   - Large payloads are truncated properly

## Success Criteria

- [ ] Debug output goes to stderr only
- [ ] Sensitive information is never logged
- [ ] Request/response details are logged
- [ ] Config resolution is traceable
- [ ] Performance timing is accurate
- [ ] Verbose mode provides additional detail

## Common Issues

1. **Performance Impact**: Minimize serialization in non-debug mode
2. **Sensitive Data**: Always sanitize before logging
3. **Output Volume**: Truncate large payloads
4. **Namespace Confusion**: Use clear, consistent namespaces