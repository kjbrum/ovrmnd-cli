# GraphQL Support - Phase 9 Enhancement

## Overview

This document outlines the plan to add GraphQL support to the Ovrmnd CLI, enabling it to work with GraphQL APIs in addition to REST APIs. This enhancement maintains backward compatibility while providing a powerful, type-safe way for LLMs to interact with GraphQL endpoints through declarative YAML configurations.

## Requirements

- Support GraphQL queries and mutations through YAML configuration
- Maintain backward compatibility with existing REST API configurations
- Enable LLMs to execute GraphQL operations with minimal complexity
- Support GraphQL variables and operation names
- Integrate with existing authentication, caching, and transformation systems
- Provide clear error messages for GraphQL-specific errors
- Support introspection for schema discovery (future enhancement)
- Enable batch GraphQL operations

## Technical Approach

### Option 1: Minimal Integration Approach (Recommended)

Extend the existing configuration system to support GraphQL as an API type, reusing most existing infrastructure.

**Pros:**
- Minimal code changes required
- Maintains consistency with existing patterns
- Reuses authentication, caching, and transformation systems
- Easy to understand and maintain
- Lower implementation complexity

**Cons:**
- Less GraphQL-specific optimizations initially
- May need future enhancements for advanced features

### Option 2: Separate GraphQL Command

Create a new `graphql` command specifically for GraphQL operations.

**Pros:**
- Clean separation of concerns
- Can optimize specifically for GraphQL
- No risk of breaking existing REST functionality

**Cons:**
- Duplicates much existing functionality
- Inconsistent user experience
- Requires maintaining two parallel systems
- More complex for LLMs to understand

### Option 3: Full GraphQL Client Integration

Integrate a full-featured GraphQL client library like Apollo Client.

**Pros:**
- Rich feature set out of the box
- Advanced caching and state management
- Well-tested and maintained

**Cons:**
- Heavy dependency for a CLI tool
- Many features unnecessary for CLI use case
- Increases bundle size significantly
- May conflict with existing patterns

### Recommended Approach

**Option 1: Minimal Integration Approach** - This aligns best with the project's philosophy of being a lightweight bridge for LLMs. It maintains consistency while adding powerful GraphQL capabilities.

## Implementation Details

### File Structure

```
src/
  api/
    graphql.ts          # GraphQL-specific client implementation
  types/
    graphql.ts          # GraphQL-specific types
  config/
    graphql-validator.ts # GraphQL configuration validation
```

### Core Components

1. **GraphQL Types** (`src/types/graphql.ts`)
   - Purpose: Define GraphQL-specific configuration types
   - Key interfaces:
     - `GraphQLOperationConfig`: Configuration for queries/mutations
     - `GraphQLVariables`: Type-safe variable definitions
     - `GraphQLResponse`: Standard GraphQL response format

2. **GraphQL Client** (`src/api/graphql.ts`)
   - Purpose: Execute GraphQL operations
   - Key methods:
     - `executeGraphQLOperation()`: Main execution function
     - `buildGraphQLRequest()`: Construct request body
     - `parseGraphQLResponse()`: Handle GraphQL-specific response format
     - `handleGraphQLErrors()`: Process GraphQL error responses

3. **GraphQL Validator** (`src/config/graphql-validator.ts`)
   - Purpose: Validate GraphQL configurations
   - Key validations:
     - Query/mutation syntax validation
     - Variable definition validation
     - Operation name validation

### Configuration Changes

#### Service Configuration with GraphQL

```yaml
serviceName: github-graphql
baseUrl: https://api.github.com
apiType: graphql                    # New field (defaults to 'graphql')
graphqlEndpoint: /graphql           # GraphQL endpoint path
authentication:
  type: bearer
  token: ${GITHUB_TOKEN}

# GraphQL operations instead of REST endpoints
graphqlOperations:
  - name: getRepository
    operationType: query            # 'query' or 'mutation'
    query: |
      query GetRepository($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
          name
          description
          stargazerCount
          issues(first: 5) {
            nodes {
              title
              state
            }
          }
        }
      }
    cacheTTL: 300                  # Caching works for queries
    transform:                     # Transformation works on GraphQL responses
      fields: ["repository.name", "repository.stargazerCount"]
  
  - name: createIssue
    operationType: mutation
    query: |
      mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
        createIssue(input: {
          repositoryId: $repositoryId,
          title: $title,
          body: $body
        }) {
          issue {
            id
            number
            title
            url
          }
        }
      }

# Aliases work with GraphQL operations
aliases:
  - name: myRepo
    endpoint: getRepository
    args:
      owner: myusername
      name: myproject
```

#### Type Definitions

```typescript
// src/types/config.ts additions
export type ApiType = 'rest' | 'graphql';

export interface ServiceConfig {
  // ... existing fields
  apiType?: ApiType;
  graphqlEndpoint?: string;
  graphqlOperations?: GraphQLOperationConfig[];
}

// src/types/graphql.ts
export interface GraphQLOperationConfig {
  name: string;
  operationType?: 'query' | 'mutation';
  query: string;
  variables?: Record<string, unknown>;
  cacheTTL?: number;
  transform?: TransformConfig | TransformConfig[];
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}
```

### API/SDK Integration

For the initial implementation, we'll use the native `fetch` API with GraphQL-specific handling, similar to the existing REST implementation. This keeps the tool lightweight while providing full GraphQL capabilities.

Future enhancements could include:
- GraphQL schema introspection support
- Type generation from GraphQL schemas
- Integration with GraphQL Code Generator for type safety

## Code Changes (High Level)

### New Files

- `src/api/graphql.ts` - GraphQL client implementation with operation execution
- `src/types/graphql.ts` - GraphQL-specific type definitions
- `src/config/graphql-validator.ts` - GraphQL configuration validation

### Modified Files

- `src/types/config.ts` - Add `apiType`, `graphqlEndpoint`, and `graphqlOperations` fields
- `src/api/client.ts` - Add GraphQL execution path in main execute function
- `src/commands/call.ts` - Route to GraphQL or REST based on service configuration
- `src/config/validator.ts` - Add GraphQL-specific validation rules
- `src/api/params.ts` - Add GraphQL variable mapping support

### Example Usage

```bash
# Execute a GraphQL query
ovrmnd call github-graphql.getRepository owner=octocat name=Hello-World

# Execute with additional variables
ovrmnd call github-graphql.getRepository owner=octocat name=Hello-World includeForks=true

# Execute a mutation
ovrmnd call github-graphql.createIssue repositoryId=MDEwOlJlcG9zaXRvcnkxMjk2MjY5 title="New Issue" body="Issue description"

# Use an alias
ovrmnd call github-graphql.myRepo

# Batch operations
ovrmnd call github-graphql.getRepository --batch-json='[{"owner":"octocat","name":"Hello-World"},{"owner":"facebook","name":"react"}]'

# Pretty output
ovrmnd call github-graphql.getRepository owner=octocat name=Hello-World --pretty

# Debug mode to see GraphQL request
ovrmnd call github-graphql.getRepository owner=octocat name=Hello-World --debug
```

## Security Considerations

- **Query Injection**: Validate that GraphQL queries are defined in YAML, not passed as CLI arguments
- **Variable Sanitization**: Ensure variables are properly typed and validated
- **Authentication**: Reuse existing auth system - GraphQL endpoints often use same auth as REST
- **Rate Limiting**: GraphQL queries can be more expensive - respect rate limits
- **Query Complexity**: Document best practices for avoiding overly complex queries
- **Introspection**: Disable introspection queries in production configurations

## Testing Strategy

- **Unit Tests**:
  - GraphQL request building
  - GraphQL response parsing
  - GraphQL error handling
  - Variable mapping and validation
  
- **Integration Tests**:
  - Full GraphQL query execution
  - Mutation execution
  - Error scenarios (network, GraphQL errors)
  - Caching behavior for queries
  - Transformation on GraphQL responses
  
- **Manual Testing Scenarios**:
  - Test with GitHub GraphQL API
  - Test with Shopify GraphQL API
  - Test error handling with malformed queries
  - Test variable validation

## Documentation Updates

- **README.md**:
  - Add GraphQL configuration examples
  - Update feature list to include GraphQL support
  - Add GraphQL-specific usage examples
  
- **CLAUDE.md**:
  - Document GraphQL implementation phase
  - Add GraphQL testing instructions
  - Update architecture section
  
- **User Guides Needed**:
  - "Configuring GraphQL Services" guide
  - "GraphQL vs REST" comparison for YAML configs
  - "Common GraphQL Patterns" examples

## Migration/Upgrade Path

1. **Backward Compatibility**: All existing REST configurations continue to work unchanged
2. **Opt-in Migration**: Services can be gradually migrated to GraphQL by:
   - Adding `apiType: graphql`
   - Converting endpoints to graphqlOperations
   - Updating aliases to reference GraphQL operations
3. **Dual Support**: Services can maintain both REST and GraphQL configs during transition
4. **No Breaking Changes**: Existing CLI commands and options work identically

## Important Files

Files discovered during research:
- `src/api/client.ts` - Core HTTP client that needs GraphQL support
- `src/types/config.ts` - Configuration types to extend
- `src/commands/call.ts` - Main command that routes requests
- `src/api/params.ts` - Parameter mapping logic
- `src/config/validator.ts` - Configuration validation
- `src/api/auth.ts` - Authentication system (works for GraphQL too)
- `src/services/ai-config-generator.ts` - Could be enhanced to generate GraphQL configs

## Future Considerations

This GraphQL support enables future enhancements:

1. **Schema Introspection**: Query GraphQL schemas to auto-generate configurations
2. **Type Generation**: Use GraphQL Code Generator for type-safe operations
3. **Subscription Support**: Add WebSocket support for GraphQL subscriptions
4. **Federation Support**: Handle federated GraphQL schemas
5. **Query Optimization**: Implement query complexity analysis
6. **AI Config Generation**: Enhance AI generator to create GraphQL configurations
7. **GraphQL-specific Caching**: Implement normalized caching for GraphQL responses
8. **Operation Validation**: Validate queries against schema before execution

## Implementation Checklist

Core functionality tasks:
- [ ] Create GraphQL type definitions
- [ ] Implement GraphQL client with operation execution
- [ ] Add GraphQL configuration validation
- [ ] Update call command to support GraphQL
- [ ] Implement GraphQL error handling
- [ ] Add GraphQL variable mapping

Test implementation tasks:
- [ ] Unit tests for GraphQL client
- [ ] Integration tests for GraphQL operations
- [ ] Manual testing with real GraphQL APIs
- [ ] Error scenario testing

Documentation tasks:
- [ ] Update README with GraphQL examples
- [ ] Create GraphQL configuration guide
- [ ] Update CLAUDE.md with implementation details
- [ ] Add GraphQL patterns to testing.yaml

Integration tasks:
- [ ] Ensure caching works with GraphQL queries
- [ ] Verify transformations work on GraphQL responses
- [ ] Test batch operations with GraphQL
- [ ] Validate debug output for GraphQL requests