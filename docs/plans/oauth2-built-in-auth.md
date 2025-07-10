# OAuth2 Built-in Authentication Plan

## Overview

This document outlines a simplified implementation plan for adding OAuth2 as a built-in authentication type in ovrmnd-cli, alongside the existing `bearer` and `apikey` types.

## Goals

1. **Built-in OAuth2 Support**: Add OAuth2 as a native authentication type
2. **Secure Token Storage**: Store tokens securely using system keychains
3. **Automatic Token Management**: Handle token refresh automatically
4. **User-Friendly Setup**: Interactive authentication flow with clear instructions
5. **Multiple OAuth2 Flows**: Support both device flow and browser flow

## Implementation Approach

### 1. Extend Authentication Types

```typescript
// src/types/config.ts
export type AuthType = 'bearer' | 'apikey' | 'oauth2'

export interface OAuth2AuthConfig {
  type: 'oauth2'
  clientId: string
  clientSecret?: string
  authorizationUrl: string
  tokenUrl: string
  revokeUrl?: string
  scopes?: string[]
  flow?: 'device' | 'browser'  // Default: 'device'
}

export type AuthConfig = BearerAuthConfig | ApiKeyAuthConfig | OAuth2AuthConfig
```

### 2. Token Storage Service

```typescript
// src/services/token-storage.ts
export class TokenStorage {
  async save(serviceName: string, tokens: OAuth2Tokens): Promise<void>
  async load(serviceName: string): Promise<OAuth2Tokens | null>
  async delete(serviceName: string): Promise<void>
  async list(): Promise<string[]>
}

export interface OAuth2Tokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
}
```

### 3. OAuth2 Service

```typescript
// src/services/oauth2.ts
export class OAuth2Service {
  // Device flow implementation
  async authenticateDeviceFlow(config: OAuth2AuthConfig): Promise<OAuth2Tokens>
  
  // Browser flow implementation
  async authenticateBrowserFlow(config: OAuth2AuthConfig): Promise<OAuth2Tokens>
  
  // Token refresh
  async refreshTokens(config: OAuth2AuthConfig, tokens: OAuth2Tokens): Promise<OAuth2Tokens>
  
  // Check if refresh needed
  needsRefresh(tokens: OAuth2Tokens): boolean
  
  // Apply auth to request
  applyAuth(tokens: OAuth2Tokens, headers: Record<string, string>): Record<string, string>
}
```

### 4. Update Auth Module

```typescript
// src/api/auth.ts
export function applyAuth(
  config: ResolvedServiceConfig,
  headers: AuthHeaders = {},
): AuthHeaders {
  if (!config.authentication) {
    return headers
  }

  const auth = config.authentication
  
  switch (auth.type) {
    case 'bearer':
      // Existing bearer implementation
      
    case 'apikey':
      // Existing apikey implementation
      
    case 'oauth2':
      // Check for stored tokens
      const tokens = await tokenStorage.load(config.serviceName)
      if (!tokens) {
        throw new OvrmndError({
          code: ErrorCode.AUTH_MISSING,
          message: 'OAuth2 authentication required',
          help: `Run: ovrmnd auth login ${config.serviceName}`
        })
      }
      
      // Refresh if needed
      if (oauth2Service.needsRefresh(tokens)) {
        const refreshed = await oauth2Service.refreshTokens(auth, tokens)
        await tokenStorage.save(config.serviceName, refreshed)
        tokens = refreshed
      }
      
      return oauth2Service.applyAuth(tokens, headers)
  }
}
```

### 5. Auth Commands

```bash
# Authenticate with a service
ovrmnd auth login <service> [--flow device|browser] [--force]

# Check authentication status
ovrmnd auth status <service>

# Remove authentication
ovrmnd auth logout <service>

# List authenticated services
ovrmnd auth list
```

### 6. YAML Configuration

```yaml
# Example: Strava API with OAuth2
serviceName: strava
baseUrl: https://www.strava.com/api/v3
authentication:
  type: oauth2
  clientId: ${STRAVA_CLIENT_ID}
  clientSecret: ${STRAVA_CLIENT_SECRET}
  authorizationUrl: https://www.strava.com/oauth/authorize
  tokenUrl: https://www.strava.com/oauth/token
  scopes: 
    - read
    - activity:read_all
  flow: device
endpoints:
  - name: athlete
    method: GET
    path: /athlete
    cacheTTL: 300
```

### 7. Common Provider Templates

Create templates for popular OAuth2 providers:

```typescript
// src/services/oauth2-providers.ts
export const OAuth2Providers = {
  github: {
    authorizationUrl: 'https://github.com/login/device/code',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    flow: 'device'
  },
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    flow: 'browser'
  },
  strava: {
    authorizationUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    flow: 'browser'
  }
}
```

## User Experience

### First-Time Authentication

```bash
$ ovrmnd call strava.athlete
Error: OAuth2 authentication required
Help: Run: ovrmnd auth login strava

$ ovrmnd auth login strava
Starting OAuth2 device flow authentication...

Please visit: https://www.strava.com/oauth/device
Enter code: ABCD-1234

Waiting for authorization... ✓
Authentication successful! Tokens saved securely.

$ ovrmnd call strava.athlete
{
  "id": 12345,
  "username": "johndoe",
  "firstname": "John",
  "lastname": "Doe"
}
```

### Automatic Token Refresh

```bash
# Token expired, but refresh token available
$ ovrmnd call strava.athlete
# Automatically refreshes token in background
{
  "id": 12345,
  "username": "johndoe"
}
```

## Implementation Phases

### Phase 1: Core OAuth2 Support
1. Extend config types for OAuth2
2. Implement token storage with keytar
3. Create OAuth2Service with device flow
4. Update auth.ts to handle OAuth2 type

### Phase 2: Auth Commands
1. Implement auth login command
2. Implement auth status command
3. Implement auth logout command
4. Implement auth list command

### Phase 3: Browser Flow & Providers
1. Add browser flow support with PKCE
2. Create provider templates
3. Update init command to support OAuth2 setup
4. Add provider detection

### Phase 4: Polish & Testing
1. Comprehensive error handling
2. Progress indicators for flows
3. Unit and integration tests
4. Documentation and examples

## Security Considerations

1. **No Client Secrets in Device Flow**: Device flow doesn't require client secret
2. **PKCE for Browser Flow**: Use Proof Key for Code Exchange
3. **Secure Token Storage**: Use system keychains via keytar
4. **Token Scope Minimization**: Request only necessary scopes
5. **Automatic Token Cleanup**: Remove expired tokens

## Dependencies

- `keytar`: For secure token storage
- `open`: For opening browser (browser flow)
- `express`: For local redirect server (browser flow)
- Built-in `crypto` for PKCE challenge/verifier

## Benefits Over Plugin Approach

1. **Simpler Implementation**: No dynamic loading or plugin discovery
2. **Better Type Safety**: All types known at compile time
3. **Easier Testing**: Direct unit tests without mocking plugins
4. **Clearer User Experience**: Just another auth type in YAML
5. **Faster Performance**: No overhead of plugin system

## Future Considerations

- Support for OAuth2 extensions (like OIDC)
- Token visualization in auth status
- Multi-account support per service
- Refresh token rotation support
- Device flow interval adjustment based on provider response