# Task: Define YAML Schema & Parameter Mapping

## Overview

Define the complete YAML schema for service configurations and implement the logic for automatic path parameter detection and parameter mapping.

## Requirements

1. **Schema Definition**
   - Clear TypeScript interfaces for all configuration elements
   - Support for all authentication types
   - Flexible parameter definitions

2. **Path Parameter Detection**
   - Automatically detect `{paramName}` in paths
   - Mark as required parameters
   - Prevent redefinition in parameters list

3. **Parameter Mapping**
   - Map CLI arguments to appropriate parameter types
   - Support body, query, header parameters
   - Handle different body types (JSON, form data)

4. **Validation**
   - Ensure required fields are present
   - Validate parameter types and conflicts
   - Check for duplicate parameter names

## Schema Structure

### Complete YAML Example
```yaml
serviceName: shopify-admin
baseUrl: https://{shop}.myshopify.com/admin/api/2024-01
authentication:
  type: apiKey
  header: X-Shopify-Access-Token
  token: ${SHOPIFY_ACCESS_TOKEN}

endpoints:
  - name: get-product
    method: GET
    path: /products/{productId}.json
    cacheTTL: 300
    transform:
      fields: ["product.id", "product.title", "product.vendor"]
      
  - name: create-product
    method: POST
    path: /products.json
    bodyType: json
    parameters:
      - name: product
        type: body
        required: true
        schema:
          type: object
          properties:
            title: { type: string }
            vendor: { type: string }
            
  - name: update-inventory
    method: POST
    path: /inventory_levels/set.json
    parameters:
      - name: location_id
        type: body
        required: true
      - name: inventory_item_id
        type: body
        required: true
      - name: available
        type: body
        required: true
        
aliases:
  - name: my-products
    endpoint: get-product
    args:
      shop: my-store
  - name: create-draft
    endpoint: create-product
    args:
      shop: my-store
      product:
        status: draft
```

## Implementation Details

### 1. Parameter Types
```typescript
export type ParameterType = 'body' | 'query' | 'header' | 'path';

export interface ParameterConfig {
  name: string;
  type: ParameterType;
  required?: boolean;
  default?: any;
  description?: string;
  schema?: any; // For complex validation
}
```

### 2. Path Parameter Detection
```typescript
export function extractPathParameters(path: string): string[] {
  const params: string[] = [];
  const regex = /{([^}]+)}/g;
  let match;
  
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  
  return params;
}

export function buildEffectiveParameters(endpoint: EndpointConfig): Map<string, ParameterConfig> {
  const params = new Map<string, ParameterConfig>();
  
  // Add path parameters as required
  const pathParams = extractPathParameters(endpoint.path);
  pathParams.forEach(name => {
    params.set(name, {
      name,
      type: 'path',
      required: true
    });
  });
  
  // Add defined parameters
  endpoint.parameters?.forEach(param => {
    if (params.has(param.name) && param.type === 'path') {
      throw new Error(`Path parameter '${param.name}' cannot be redefined`);
    }
    params.set(param.name, param);
  });
  
  return params;
}
```

### 3. Request Building
```typescript
export interface RequestBuilder {
  buildUrl(endpoint: EndpointConfig, args: Record<string, any>): string;
  buildHeaders(auth: AuthConfig, params: Map<string, ParameterConfig>, args: Record<string, any>): Headers;
  buildBody(endpoint: EndpointConfig, params: Map<string, ParameterConfig>, args: Record<string, any>): any;
  buildQuery(params: Map<string, ParameterConfig>, args: Record<string, any>): URLSearchParams;
}
```

### 4. Validation Rules
```typescript
export function validateEndpoint(endpoint: EndpointConfig): ValidationResult {
  const errors: string[] = [];
  
  // Check required fields
  if (!endpoint.name) errors.push('Endpoint name is required');
  if (!endpoint.method) errors.push('HTTP method is required');
  if (!endpoint.path) errors.push('Path is required');
  
  // Validate method
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!validMethods.includes(endpoint.method.toUpperCase())) {
    errors.push(`Invalid method: ${endpoint.method}`);
  }
  
  // Check for path parameter conflicts
  const pathParams = extractPathParameters(endpoint.path);
  endpoint.parameters?.forEach(param => {
    if (pathParams.includes(param.name) && param.type !== 'path') {
      errors.push(`Parameter '${param.name}' is a path parameter and cannot have type '${param.type}'`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}
```

## Testing Strategy

1. **Schema Validation Tests**
   - Valid configurations
   - Missing required fields
   - Invalid parameter types
   - Path parameter conflicts

2. **Parameter Extraction Tests**
   - Simple path parameters: `/users/{id}`
   - Multiple parameters: `/repos/{owner}/{repo}/issues`
   - No parameters: `/users`

3. **Request Building Tests**
   - URL construction with path parameters
   - Query parameter encoding
   - Body construction for different content types
   - Header injection

## Edge Cases

1. **Nested Path Parameters**: `/api/{version}/users/{id}`
2. **Special Characters**: Parameters with `-`, `_`, etc.
3. **Array Parameters**: Query parameters that accept arrays
4. **Complex Body Schemas**: Nested objects in request body
5. **Optional Path Segments**: `/products{.format}` style paths

## Success Criteria

- [ ] TypeScript interfaces cover all schema elements
- [ ] Path parameters are automatically detected
- [ ] Parameter conflicts are caught during validation
- [ ] Request building handles all parameter types
- [ ] Comprehensive validation with helpful errors
- [ ] Support for complex body structures