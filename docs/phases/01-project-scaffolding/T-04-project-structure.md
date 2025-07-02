# Task: Project Structure Definition

## Overview

Define and implement a clean, scalable directory structure with proper TypeScript type definitions and module organization.

## Requirements

1. **Directory Organization**
   - Clear separation of concerns
   - Logical grouping of related modules
   - Scalable for future additions
   - Easy to navigate

2. **Type Definitions**
   - Comprehensive interfaces for all data structures
   - Shared types in central location
   - Proper type exports
   - No implicit any types

3. **Module Aliases**
   - Clean import paths
   - Avoid relative path hell
   - Consistent naming conventions

## Directory Structure

```
ovrmnd-cli/
├── bin/
│   └── ovrmnd              # CLI entry point
├── src/
│   ├── cli.ts              # Main CLI setup
│   ├── index.ts            # Public API exports
│   ├── commands/           # CLI command implementations
│   │   ├── index.ts
│   │   ├── base-command.ts
│   │   ├── call.ts
│   │   ├── list.ts
│   │   ├── cache.ts
│   │   ├── init.ts
│   │   ├── test.ts
│   │   └── validate.ts
│   ├── config/             # Configuration management
│   │   ├── index.ts
│   │   ├── discovery.ts
│   │   ├── loader.ts
│   │   ├── parser.ts
│   │   ├── resolver.ts
│   │   └── validator.ts
│   ├── api/                # API execution logic
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── request-builder.ts
│   │   └── response-handler.ts
│   ├── cache/              # Caching implementation
│   │   ├── index.ts
│   │   ├── storage.ts
│   │   └── key-generator.ts
│   ├── transform/          # Response transformation
│   │   ├── index.ts
│   │   └── transformer.ts
│   ├── utils/              # Shared utilities
│   │   ├── index.ts
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   ├── config-loader.ts
│   │   └── file-system.ts
│   └── types/              # TypeScript type definitions
│       ├── index.ts
│       ├── config.ts
│       ├── api.ts
│       ├── cache.ts
│       └── cli.ts
├── test/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                   # Documentation
├── examples/               # Example YAML configs
│   ├── github.yaml
│   ├── slack.yaml
│   └── shopify.yaml
└── scripts/                # Build/deploy scripts
```

## Type Definitions

### 1. Core Configuration Types
```typescript
// src/types/config.ts
export interface ServiceConfig {
  serviceName: string;
  baseUrl: string;
  authentication: AuthConfig;
  endpoints: EndpointConfig[];
  aliases?: AliasConfig[];
}

export interface AuthConfig {
  type: 'bearer' | 'apiKey';
  token?: string;
  header?: string;
  queryParam?: string;
}

export interface EndpointConfig {
  name: string;
  method: HttpMethod;
  path: string;
  bodyType?: 'json' | 'form';
  parameters?: ParameterConfig[];
  cacheTTL?: number;
  transform?: TransformConfig;
}

export interface ParameterConfig {
  name: string;
  type: ParameterType;
  required?: boolean;
  default?: any;
  description?: string;
  schema?: any;
}

export interface AliasConfig {
  name: string;
  endpoint: string;
  args: Record<string, any>;
  description?: string;
}

export interface TransformConfig {
  fields?: string[];
  rename?: Record<string, string>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ParameterType = 'path' | 'query' | 'body' | 'header';
```

### 2. API Types
```typescript
// src/types/api.ts
export interface ApiRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

export interface ResponseMetadata {
  timestamp: number;
  duration: number;
  cached: boolean;
  cacheKey?: string;
}

export interface RequestContext {
  service: ServiceConfig;
  endpoint: EndpointConfig;
  args: Record<string, any>;
  options: RequestOptions;
}

export interface RequestOptions {
  json?: boolean;
  debug?: boolean;
  noCache?: boolean;
  timeout?: number;
}
```

### 3. CLI Types
```typescript
// src/types/cli.ts
import { Arguments } from 'yargs';

export interface BaseCommandArgs {
  json?: boolean;
  debug?: boolean;
  help?: boolean;
}

export interface CallCommandArgs extends BaseCommandArgs {
  service: string;
  [key: string]: any; // Dynamic arguments
}

export interface ListCommandArgs extends BaseCommandArgs {
  type: 'services' | 'endpoints' | 'aliases';
  service?: string;
}

export interface CacheCommandArgs extends BaseCommandArgs {
  action: 'clear' | 'stats';
  target?: string;
}

export interface OutputFormatter {
  format<T>(data: T): string;
  error(error: Error | ApiError): string;
}
```

### 4. Cache Types
```typescript
// src/types/cache.ts
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  metadata?: CacheMetadata;
}

export interface CacheMetadata {
  url: string;
  method: string;
  service: string;
  endpoint: string;
}

export interface CacheStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl: number, metadata?: CacheMetadata): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<number>;
  stats(): Promise<CacheStats>;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}
```

## Module Organization

### 1. Index Exports
```typescript
// src/index.ts
// Public API exports
export * from './types';
export { OvrmndError, ErrorCode } from './utils/errors';
export { createLogger } from './utils/logger';
export { loadConfig } from './utils/config-loader';

// src/commands/index.ts
export { CallCommand } from './call';
export { ListCommand } from './list';
export { CacheCommand } from './cache';
// ... other commands

// src/types/index.ts
export * from './config';
export * from './api';
export * from './cli';
export * from './cache';
```

### 2. Module Aliases (tsconfig.json)
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@commands/*": ["commands/*"],
      "@config/*": ["config/*"],
      "@api/*": ["api/*"],
      "@cache/*": ["cache/*"],
      "@utils/*": ["utils/*"],
      "@types": ["types"],
      "@transform/*": ["transform/*"]
    }
  }
}
```

### 3. Example Import Usage
```typescript
// Instead of: import { ServiceConfig } from '../../../types/config';
import { ServiceConfig } from '@types';

// Instead of: import { createLogger } from '../../utils/logger';
import { createLogger } from '@utils/logger';

// Instead of: import { CallCommand } from '../commands/call';
import { CallCommand } from '@commands/call';
```

## Naming Conventions

1. **Files**: kebab-case (e.g., `request-builder.ts`)
2. **Classes**: PascalCase (e.g., `RequestBuilder`)
3. **Interfaces**: PascalCase with descriptive names (e.g., `ServiceConfig`)
4. **Functions**: camelCase (e.g., `buildRequest`)
5. **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
6. **Type aliases**: PascalCase (e.g., `HttpMethod`)

## Testing Strategy

1. **Type Testing**
   - Ensure all exports are properly typed
   - No implicit any types
   - Proper type inference

2. **Module Resolution**
   - Test that aliases work correctly
   - Verify circular dependencies are avoided
   - Check that all modules export properly

## Success Criteria

- [ ] All directories created according to structure
- [ ] Type definitions cover all data structures
- [ ] No TypeScript errors with strict mode
- [ ] Module aliases work correctly
- [ ] Clean import statements throughout codebase
- [ ] Consistent naming conventions applied

## Common Issues

1. **Circular Dependencies**: Structure prevents circular imports
2. **Type Exports**: Ensure all types are properly exported
3. **Path Aliases**: Configure both TypeScript and Jest
4. **Index Files**: Avoid barrel exports that create bundles