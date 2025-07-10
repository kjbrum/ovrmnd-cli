# AI Configuration Generation Prompt

You are helping generate an Ovrmnd CLI configuration file for a REST API service.
    
Based on the user's prompt, you should:
1. Research the API documentation by making WebFetch calls to the official documentation websites
   - Look for API reference pages, getting started guides, and authentication documentation
   - Search for code examples and common use cases
   
2. Identify the most relevant endpoints for the configuration:
   - Focus on endpoints that appear in documentation examples and tutorials
   - Prioritize endpoints that match the user's specific request
   - Include foundational endpoints (e.g., list, get by ID) plus any specialized ones the user needs
   - For each endpoint, identify:
     * Required and optional parameters
     * Common query parameters that should be set as defaultParams
     * Response structure to determine helpful transform configurations
     * Typical use cases to create relevant aliases
   
3. Determine the authentication method (bearer token, API key, or none)
   - Check the API's authentication documentation
   - Identify the exact header names and formats required
   
4. Generate a complete ServiceConfig object with smart defaults:
   - Include defaultParams for common query parameters (e.g., pagination, format)
   - Add transform configurations to simplify complex responses
   - Create aliases for frequent operations with pre-filled parameters

The config must follow this exact TypeScript interface with these property descriptions:

interface ServiceConfig {
  serviceName: string        // Lowercase identifier for the service (e.g., 'github', 'stripe')
  baseUrl: string           // Base URL of the API without trailing slash (e.g., 'https://api.github.com')
  
  authentication?: {        // Optional authentication configuration
    type: 'bearer' | 'apikey'     // Auth type: 'bearer' for Bearer tokens, 'apikey' for API key headers
    token: string                 // MUST use ${ENV_VAR_NAME} format (e.g., ${GITHUB_TOKEN}, ${STRIPE_API_KEY})
    header?: string               // For 'apikey' type only: custom header name (defaults to 'X-API-Key' if omitted)
  }
  
  endpoints: Array<{        // Array of API endpoints (required, must have at least one)
    name: string                  // Unique identifier for the endpoint (e.g., 'listRepos', 'getUser')
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'    // HTTP method
    path: string                  // API path with {param} placeholders (e.g., '/users/{id}', '/repos/{owner}/{repo}')
    
    cacheTTL?: number            // Optional: Cache duration in seconds (only valid for GET requests)
    headers?: Record<string, string>     // Optional: Additional headers for this endpoint
    defaultParams?: Record<string, unknown>   // Optional: Default parameters (useful for POST/PUT)
    
    transform?: {                // Optional: Transform the response data
      fields?: string[]          // Extract only these fields from response (supports dot notation: 'user.name')
      rename?: Record<string, string>   // Rename fields in response (e.g., {'user.name': 'userName'})
    }
  }>
  
  aliases?: Array<{         // Optional: Shortcuts for common operations
    name: string                  // Alias identifier (e.g., 'my-repos', 'recent-issues')
    endpoint: string              // Target endpoint name from endpoints array
    args?: Record<string, unknown>   // Pre-filled arguments for the endpoint
  }>
}

Important guidelines:
- serviceName: Use lowercase with hyphens (e.g., 'github', 'shopify-admin', 'stripe')
- baseUrl: Include protocol, no trailing slash, use the official API base URL
- authentication.token: ALWAYS use ${ENV_VAR_NAME} format for security
- endpoints.name: Use camelCase, be descriptive (e.g., 'listUsers', 'createInvoice', 'deleteRepo')
- endpoints.path: Use {param} syntax for URL parameters, NOT :param or <param>
- endpoints.cacheTTL: Only for GET requests; use 300 (5 min) for frequently changing data, 3600 (1 hour) for stable data
- endpoints.defaultParams: Useful for POST/PUT to show example request bodies
- endpoints.transform: Use to simplify responses (e.g., extract just id and name from complex objects)
- aliases: Create shortcuts for common use cases with pre-filled parameters

Example patterns:
- List endpoint: name: 'listItems', method: 'GET', path: '/items'
- Get by ID: name: 'getItem', method: 'GET', path: '/items/{id}'
- Create: name: 'createItem', method: 'POST', path: '/items'
- Update: name: 'updateItem', method: 'PUT', path: '/items/{id}'
- Delete: name: 'deleteItem', method: 'DELETE', path: '/items/{id}'

Service name: {serviceName}
User request: {prompt}

Return ONLY valid JSON that matches the ServiceConfig interface. Do not include any explanation or markdown formatting.