# Task: T-03 - Implement Debug Mode

**Phase:** 3: CLI Usability & DX
**Status:** `Not Started`

## Objective

Implement a `--debug` flag that enables verbose logging for troubleshooting. This debug output will include detailed information about requests, responses, configuration resolution, and other internal processes, and will be sent to `stderr` to avoid interfering with `stdout` (especially for JSON output).

## Technical Plan

### 1. Detecting Debug Mode

-   **`yargs` Configuration:**
    -   Add a `--debug` boolean option to the main `yargs` configuration.
    -   The value of this flag (`argv.debug`) will be passed to a global logging utility or directly checked within functions that produce debug output.

### 2. Logging Implementation

-   **Centralized Logging Utility:**
    -   Create a simple logging utility (e.g., `src/utils/logger.js`) with functions like `logDebug(message, data)`.
    -   This utility will check if the `debug` flag is enabled.
    -   If enabled, it will print the `message` and optionally `data` (e.g., objects, arrays) to `console.error()`.
    -   Using `console.error()` ensures that debug output goes to `stderr`, keeping `stdout` clean for primary command output (especially important for machine-readable JSON output).
-   **Verbose Logging Points:**
    -   Integrate calls to the `logDebug` utility at key points throughout the application, including:
        -   **Configuration Resolution (Phase 2, T-01):** Details about which global/local config files are found, parsed, and merged.
        -   **Schema Validation (Phase 2, T-02):** Information about the validation process, including any warnings or detailed reasons for validation failures.
        -   **Authentication (Phase 2, T-03):** Confirmation of which authentication method is applied and from which environment variable the secret was sourced (without logging the secret itself).
        -   **Parameter Mapping (Phase 2, T-02):** Details on how CLI arguments are mapped to path, query, body, and header parameters.
        -   **HTTP Requests (Phase 2, T-04):** Full request details (URL, method, headers, body) before sending.
        -   **HTTP Responses (Phase 2, T-04):** Full response details (status, headers, body) after receiving.
        -   **Error Handling (Phase 2, T-06):** Detailed error objects, including stack traces for unexpected errors.
        -   **Cache Operations (Phase 4, T-01, T-02):** Cache hits/misses, cache invalidation events.
        -   **Response Transformation (Phase 4, T-03):** Before and after transformation data.

## Pseudocode

```javascript
// src/utils/logger.js
let isDebugMode = false;

function setDebugMode(mode) {
    isDebugMode = mode;
}

function logDebug(message, data) {
    if (isDebugMode) {
        console.error(`[DEBUG] ${message}`);
        if (data) {
            console.error(data);
        }
    }
}

module.exports = { setDebugMode, logDebug };

// In your main CLI entry point (e.g., src/index.js)
const yargs = require('yargs');
const { setDebugMode, logDebug } = require('./utils/logger');

yargs.option('debug', {
    type: 'boolean',
    describe: 'Enable verbose debug logging',
    default: false,
});

// Before processing commands
setDebugMode(yargs.argv.debug);

// Example usage in a command handler (e.g., call command)
async (argv) => {
    logDebug('Starting API call process...', { service: serviceName, endpoint: endpointName });
    try {
        // ... (API call logic)
        logDebug('Request config:', requestConfig);
        const response = await fetch(requestUrl, requestOptions);
        logDebug('Response received:', response.data);
        // ...
    } catch (error) {
        logDebug('Error during API call:', error);
        // ...
    }
}
```
