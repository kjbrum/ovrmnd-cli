# Task: Implement YAML Configuration Engine

## Overview

Build the foundation for loading, parsing, and managing YAML configuration files from both global (`~/.ovrmnd/`) and local (`./.ovrmnd/`) directories.

## Requirements

1. **Discovery Logic**
   - Scan `~/.ovrmnd/*.yaml` and `~/.ovrmnd/*.yml` for global configs
   - Scan `./.ovrmnd/*.yaml` and `./.ovrmnd/*.yml` for local configs
   - Support subdirectories for organization

2. **Loading & Parsing**
   - Use `js-yaml` for parsing YAML files
   - Handle parsing errors gracefully
   - Support both `.yaml` and `.yml` extensions

3. **Merging Strategy**
   - Local configs override global configs with same service name
   - Merge at the service level, not individual properties
   - Maintain a registry of all discovered services

4. **Caching**
   - Cache parsed configurations in memory
   - Invalidate cache when files change (optional for V1)

## Implementation Steps

### 1. Create Config Types
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
  method: string;
  path: string;
  bodyType?: 'json' | 'form';
  parameters?: ParameterConfig[];
  cacheTTL?: number;
  transform?: TransformConfig;
}
```

### 2. Implement Config Discovery
```typescript
// src/config/discovery.ts
export async function discoverConfigs(): Promise<Map<string, ServiceConfig>> {
  const configs = new Map<string, ServiceConfig>();
  
  // Load global configs
  const globalConfigs = await loadConfigsFromDir('~/.ovrmnd');
  
  // Load local configs
  const localConfigs = await loadConfigsFromDir('./.ovrmnd');
  
  // Merge with local overriding global
  return mergeConfigs(globalConfigs, localConfigs);
}
```

### 3. Implement YAML Loading
```typescript
// src/config/loader.ts
export async function loadYamlFile(filePath: string): Promise<ServiceConfig> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const config = yaml.load(content) as ServiceConfig;
    
    // Basic validation
    validateServiceConfig(config);
    
    return config;
  } catch (error) {
    throw new ConfigError(`Failed to load ${filePath}: ${error.message}`);
  }
}
```

### 4. Environment Variable Resolution
```typescript
// src/config/resolver.ts
export function resolveEnvVars(config: ServiceConfig): ServiceConfig {
  // Deep clone to avoid mutations
  const resolved = JSON.parse(JSON.stringify(config));
  
  // Recursively replace ${VAR_NAME} with process.env.VAR_NAME
  walkObject(resolved, (value) => {
    if (typeof value === 'string') {
      return value.replace(/\${([^}]+)}/g, (_, varName) => {
        return process.env[varName] || '';
      });
    }
    return value;
  });
  
  return resolved;
}
```

## Testing Strategy

1. **Unit Tests**
   - Test YAML parsing with valid/invalid files
   - Test environment variable resolution
   - Test config merging logic

2. **Integration Tests**
   - Test discovery with mock file system
   - Test full config loading pipeline

3. **Test Cases**
   - Valid YAML with all features
   - Invalid YAML syntax
   - Missing required fields
   - Environment variable resolution
   - Local override of global config

## Error Handling

1. **File Not Found**: Log debug message, continue
2. **YAML Parse Error**: Log error with file path, skip file
3. **Validation Error**: Log specific validation failure
4. **Missing Env Var**: Leave empty or throw based on context

## Success Criteria

- [ ] Can discover YAML files from both directories
- [ ] Can parse valid YAML files
- [ ] Handles invalid YAML gracefully
- [ ] Local configs override global configs
- [ ] Environment variables are resolved
- [ ] Comprehensive error messages