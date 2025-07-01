# Task: T-03 - Implement Authentication Handling (V1)

**Phase:** 2: Core API Execution
**Status:** `Not Started`

## Objective

Implement the initial version of authentication handling for the Ovrmnd CLI, supporting Bearer Token and API Key methods. This involves securely sourcing credentials from environment variables, including support for `.env` files, and applying them to outgoing API requests.

## Technical Plan

### 1. Environment Variable Loading

-   **`dotenv` Integration:**
    -   Utilize the `dotenv` npm package to automatically load environment variables from a `.env` file located in the current working directory.
    -   This loading process should occur at the very beginning of the CLI application's execution to ensure that all environment variables, including sensitive API keys and tokens, are available before any configuration parsing or API calls are made.

### 2. Credential Application to API Requests

-   **Authentication Function:**
    -   Create a function, `applyAuthentication(requestConfig, serviceConfig)`, that takes the `Request` object (or a configuration object for `fetch`) and the service's authentication configuration as input.
    -   This function will dynamically add the appropriate authentication headers or query parameters based on the `authentication` details provided in the service's YAML configuration.
-   **Bearer Token Handling:**
    -   If `serviceConfig.authentication.type` is `bearer`:
        -   Retrieve the token value from `process.env[serviceConfig.authentication.token]`.
        -   Add an `Authorization` header to the `requestConfig.headers` object with the format `Bearer <token>`.
-   **API Key Handling:**
    -   If `serviceConfig.authentication.type` is `apiKey`:
        -   Retrieve the API key value from `process.env[serviceConfig.authentication.apiKey]`.
        -   Check `serviceConfig.authentication.in` to determine where the API key should be placed (`header` or `query`).
        -   Check `serviceConfig.authentication.name` to determine the name of the header or query parameter.
        -   If `in` is `header`, add a header to `requestConfig.headers` with the specified `name` and the API key value.
        -   If `in` is `query`, add a query parameter to `requestConfig.params` with the specified `name` and the API key value.
-   **Error Handling:**
    -   If a required environment variable (token or API key) is not found, throw a descriptive error to prevent the request from proceeding with missing credentials and to inform the user of the issue.

## Pseudocode

```javascript
// At the very top of your main CLI entry point (e.g., src/index.js)
require('dotenv').config();

function applyAuthentication(requestConfig, serviceConfig) {
    if (!serviceConfig.authentication) {
        return; // No authentication configured for this service
    }

    const authType = serviceConfig.authentication.type;
    const authValueEnvVar = serviceConfig.authentication.token || serviceConfig.authentication.apiKey;
    const authValue = process.env[authValueEnvVar];

    if (!authValue) {
        throw new Error(`Authentication failed: Environment variable ${authValueEnvVar} not found.`);
    }

    if (authType === 'bearer') {
        requestConfig.headers = {
            ...requestConfig.headers,
            Authorization: `Bearer ${authValue}`,
        };
    } else if (authType === 'apiKey') {
        const inLocation = serviceConfig.authentication.in;
        const paramName = serviceConfig.authentication.name;

        if (inLocation === 'header') {
            requestConfig.headers = {
                ...requestConfig.headers,
                [paramName]: authValue,
            };
        } else if (inLocation === 'query') {
            requestConfig.params = {
                ...requestConfig.params,
                [paramName]: authValue,
            };
        } else {
            throw new Error(`Unsupported API Key location: ${inLocation}`);
        }
    } else {
        throw new Error(`Unsupported authentication type: ${authType}`);
    }
}
```
