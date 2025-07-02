# Task: Implement Response Transformation

## Overview

Build a transformation pipeline that can extract specific fields and rename fields from API responses to reduce payload size and provide cleaner data for LLMs.

## Requirements

1. **Field Extraction**
   - Extract specific fields from responses
   - Support nested field paths (dot notation)
   - Handle arrays and objects
   - Preserve data types

2. **Field Renaming**
   - Rename fields for consistency
   - Support nested renaming
   - Handle conflicts gracefully

3. **Transform Operations**
   - Apply transforms after successful API calls
   - Chain multiple transformations
   - Handle errors without losing data

4. **Performance**
   - Efficient transformation algorithms
   - Minimal memory overhead
   - Support large payloads

## Implementation Steps

### 1. Transformer Core
```typescript
// src/transform/transformer.ts
import { TransformConfig } from '@types';
import { createLogger } from '@utils/logger';
import * as jsonpath from 'jsonpath';

const logger = createLogger('transformer');

export class ResponseTransformer {
  private config: TransformConfig;
  
  constructor(config: TransformConfig) {
    this.config = config;
  }
  
  transform(data: any): any {
    if (!this.config || (!this.config.fields && !this.config.rename)) {
      return data;
    }
    
    try {
      let result = data;
      
      // Apply field extraction first
      if (this.config.fields) {
        result = this.extractFields(result, this.config.fields);
      }
      
      // Apply renaming
      if (this.config.rename) {
        result = this.renameFields(result, this.config.rename);
      }
      
      return result;
    } catch (error) {
      logger.error('Transform error, returning original data', error);
      return data;
    }
  }
  
  private extractFields(data: any, fields: string[]): any {
    // Handle array of items
    if (Array.isArray(data)) {
      return data.map(item => this.extractFields(item, fields));
    }
    
    const result: any = {};
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const value = this.getNestedValue(data, field);
        if (value !== undefined) {
          this.setNestedValue(result, field, value);
        }
      } else if (field.includes('[*]')) {
        // Handle array operations
        const value = this.extractArrayField(data, field);
        if (value !== undefined) {
          const key = field.split('[')[0];
          result[key] = value;
        }
      } else {
        // Simple field extraction
        if (data.hasOwnProperty(field)) {
          result[field] = data[field];
        }
      }
    }
    
    return result;
  }
  
  private renameFields(data: any, rename: Record<string, string>): any {
    // Handle array of items
    if (Array.isArray(data)) {
      return data.map(item => this.renameFields(item, rename));
    }
    
    // Deep clone to avoid mutations
    const result = JSON.parse(JSON.stringify(data));
    
    for (const [oldPath, newPath] of Object.entries(rename)) {
      if (oldPath.includes('.') || newPath.includes('.')) {
        // Handle nested renaming
        this.renameNestedField(result, oldPath, newPath);
      } else {
        // Simple rename
        if (result.hasOwnProperty(oldPath)) {
          result[newPath] = result[oldPath];
          delete result[oldPath];
        }
      }
    }
    
    return result;
  }
  
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      if (part.includes('[') && part.includes(']')) {
        // Handle array index
        const [arrayName, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        current = current[arrayName];
        if (Array.isArray(current) && index < current.length) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }
  
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  private extractArrayField(data: any, fieldPath: string): any {
    // Handle patterns like "items[*].name"
    const [arrayPath, ...subPaths] = fieldPath.split('[*].');
    const array = this.getNestedValue(data, arrayPath);
    
    if (!Array.isArray(array)) {
      return undefined;
    }
    
    if (subPaths.length === 0) {
      return array;
    }
    
    const subPath = subPaths.join('[*].');
    return array.map(item => this.getNestedValue(item, subPath));
  }
  
  private renameNestedField(obj: any, oldPath: string, newPath: string): void {
    const value = this.getNestedValue(obj, oldPath);
    
    if (value !== undefined) {
      // Set new value
      this.setNestedValue(obj, newPath, value);
      
      // Delete old value
      this.deleteNestedValue(obj, oldPath);
    }
  }
  
  private deleteNestedValue(obj: any, path: string): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) return;
      current = current[part];
    }
    
    delete current[parts[parts.length - 1]];
  }
}
```

### 2. Advanced Transform Operations
```typescript
// src/transform/operations.ts
export interface TransformOperation {
  type: 'extract' | 'rename' | 'filter' | 'map' | 'reduce';
  config: any;
}

export class AdvancedTransformer {
  static applyOperations(data: any, operations: TransformOperation[]): any {
    let result = data;
    
    for (const operation of operations) {
      result = this.applyOperation(result, operation);
    }
    
    return result;
  }
  
  private static applyOperation(data: any, operation: TransformOperation): any {
    switch (operation.type) {
      case 'extract':
        return this.extract(data, operation.config);
      case 'rename':
        return this.rename(data, operation.config);
      case 'filter':
        return this.filter(data, operation.config);
      case 'map':
        return this.map(data, operation.config);
      case 'reduce':
        return this.reduce(data, operation.config);
      default:
        return data;
    }
  }
  
  private static filter(data: any, config: { path: string; condition: any }): any {
    if (!Array.isArray(data)) return data;
    
    return data.filter(item => {
      const value = this.getValueByPath(item, config.path);
      return this.evaluateCondition(value, config.condition);
    });
  }
  
  private static map(data: any, config: { path: string; transform: string }): any {
    if (!Array.isArray(data)) return data;
    
    return data.map(item => {
      const value = this.getValueByPath(item, config.path);
      return this.applyTransform(value, config.transform);
    });
  }
  
  private static evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object') {
      const [operator, operand] = Object.entries(condition)[0];
      
      switch (operator) {
        case '$eq': return value === operand;
        case '$ne': return value !== operand;
        case '$gt': return value > operand;
        case '$gte': return value >= operand;
        case '$lt': return value < operand;
        case '$lte': return value <= operand;
        case '$in': return (operand as any[]).includes(value);
        case '$regex': return new RegExp(operand as string).test(value);
        default: return false;
      }
    }
    
    return value === condition;
  }
  
  private static applyTransform(value: any, transform: string): any {
    switch (transform) {
      case 'uppercase': return String(value).toUpperCase();
      case 'lowercase': return String(value).toLowerCase();
      case 'trim': return String(value).trim();
      case 'number': return Number(value);
      case 'string': return String(value);
      case 'boolean': return Boolean(value);
      case 'date': return new Date(value).toISOString();
      default: return value;
    }
  }
  
  private static getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((curr, part) => curr?.[part], obj);
  }
}
```

### 3. Transform Pipeline
```typescript
// src/transform/pipeline.ts
import { ResponseTransformer } from './transformer';
import { TransformConfig } from '@types';
import { createLogger } from '@utils/logger';

const logger = createLogger('transform-pipeline');

export class TransformPipeline {
  private transformers: ResponseTransformer[] = [];
  
  constructor(configs: TransformConfig[]) {
    this.transformers = configs.map(config => new ResponseTransformer(config));
  }
  
  async execute(data: any): Promise<any> {
    let result = data;
    
    for (const transformer of this.transformers) {
      try {
        const startTime = Date.now();
        result = transformer.transform(result);
        
        logger.debug('Transform applied', {
          duration: Date.now() - startTime,
          inputSize: JSON.stringify(data).length,
          outputSize: JSON.stringify(result).length,
        });
      } catch (error) {
        logger.error('Transform failed, continuing', error);
      }
    }
    
    return result;
  }
  
  static fromEndpoint(endpoint: any): TransformPipeline | null {
    if (!endpoint.transform) {
      return null;
    }
    
    // Convert single transform to array
    const configs = Array.isArray(endpoint.transform) 
      ? endpoint.transform 
      : [endpoint.transform];
    
    return new TransformPipeline(configs);
  }
}
```

### 4. Integration with API Response
```typescript
// src/api/response-handler.ts (partial)
export class ResponseHandler {
  async handleResponse(
    response: any,
    endpoint: EndpointConfig,
    options: RequestOptions
  ): Promise<ApiResponse> {
    try {
      // Apply transformations if configured
      let data = response.data;
      
      if (endpoint.transform && !options.noTransform) {
        const pipeline = TransformPipeline.fromEndpoint(endpoint);
        if (pipeline) {
          data = await pipeline.execute(data);
          
          logger.debug('Response transformed', {
            originalSize: JSON.stringify(response.data).length,
            transformedSize: JSON.stringify(data).length,
            reduction: `${(1 - JSON.stringify(data).length / JSON.stringify(response.data).length) * 100}%`,
          });
        }
      }
      
      return {
        success: true,
        data,
        metadata: {
          timestamp: Date.now(),
          duration: response.duration,
          cached: false,
          transformed: !!endpoint.transform,
        },
      };
    } catch (error) {
      logger.error('Response handling error', error);
      throw error;
    }
  }
}
```

### 5. YAML Schema Examples
```yaml
# Example transformations in YAML config
endpoints:
  - name: list-users
    method: GET
    path: /users
    transform:
      # Extract only specific fields
      fields: ["id", "name", "email", "profile.avatar"]
      
  - name: get-orders
    method: GET
    path: /orders
    transform:
      # Extract fields and rename
      fields: ["items[*].id", "items[*].product.name", "total"]
      rename:
        "items[*].product.name": "items[*].productName"
        "total": "totalAmount"
        
  - name: search-products
    method: GET
    path: /products/search
    transform:
      # Multiple transform steps
      - type: extract
        fields: ["results[*].id", "results[*].title", "results[*].price"]
      - type: rename
        config:
          "results": "products"
      - type: filter
        config:
          path: "products[*].price"
          condition: { "$gt": 0 }
```

## Testing Strategy

1. **Basic Transform Tests**
   - Field extraction with various paths
   - Field renaming (simple and nested)
   - Array handling
   - Error recovery

2. **Complex Transform Tests**
   - Chained transformations
   - Large payload handling
   - Deep nesting
   - Performance benchmarks

3. **Integration Tests**
   - Transform with API responses
   - Cache interaction
   - Error scenarios

## Success Criteria

- [ ] Can extract specific fields from responses
- [ ] Can rename fields (including nested)
- [ ] Handles arrays correctly
- [ ] Reduces payload size significantly
- [ ] Errors don't break the response
- [ ] Performance is acceptable for large payloads

## Dependencies

```bash
npm install jsonpath
npm install --save-dev @types/jsonpath
```

## Common Issues

1. **Deep Nesting**: Handle arbitrary depth gracefully
2. **Array Operations**: Complex array transformations
3. **Performance**: Large payload optimization
4. **Type Preservation**: Maintain data types after transform