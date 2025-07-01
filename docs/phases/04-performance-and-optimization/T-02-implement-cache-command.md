# Task: T-02 - Implement CLI Command: `cache`

**Phase:** 4: Performance & Optimization
**Status:** `Not Started`

## Objective

Implement the `cache` command to provide cache management functionality. This command will allow users to clear the entire cache or clear the cache for a specific service or endpoint.

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Structure:**
    -   Define `ovrmnd cache` as a parent command.
    -   Implement subcommands:
        -   `clear [service.endpoint]`: `ovrmnd cache clear` (clears all) or `ovrmnd cache clear github.get-user` (clears specific).
-   **Positional Arguments:**
    -   For `clear` subcommand, define an optional positional argument `<service.endpoint>` to specify the service and/or endpoint.
-   **Help Messages:**
    -   Provide clear and concise help messages for the command and subcommand.

### 2. Cache Management Logic

-   **`flat-cache` Integration:**
    -   Utilize the `flat-cache` library for cache operations.
    -   The cache will be stored in a designated directory (e.g., `~/.cache/ovrmnd/`).
-   **`clear` Logic:**
    -   **Clear All:** If no `service.endpoint` is provided, use `flatCache.clearAll()` to remove all cached data.
    -   **Clear Specific Service/Endpoint:**
            -   If `service.endpoint` is provided, parse it to extract `serviceName` and `endpointName`.
            -   To achieve granular clearing with `flat-cache`, the cache ID for an endpoint will be consistently generated (e.g., `serviceName-endpointName`). The `clearCacheById` method can then be used to remove that specific cache file.
            -   For clearing an entire service, all cache files starting with `serviceName-` would need to be identified and cleared. This might involve iterating through the cache directory or using a more advanced cache management strategy if `flat-cache` doesn't provide a direct way to list all cache IDs.

### 3. Output and Error Handling Integration

-   **Dual-Mode Output (Phase 2, T-05):**
    -   All output from the `cache` command (e.g., confirmation of cache cleared) should be passed to the dual-mode output function.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors encountered (e.g., cache directory not found, invalid arguments) should be caught and passed to the standardized error output function.

## Pseudocode

```javascript
const yargs = require('yargs');
const flatCache = require('flat-cache');
const path = require('path');
const os = require('os');
// Assume printOutput, handleError are imported/available

// Define a consistent cache directory
const cacheDir = path.join(os.homedir(), '.cache', 'ovrmnd');

yargs.command(
    'cache',
    'Manage the Ovrmnd CLI cache',
    (yargs) => {
        yargs.command(
            'clear [service.endpoint]',
            'Clear the entire cache or cache for a specific service/endpoint',
            (yargs) => {
                yargs.positional('service.endpoint', {
                    describe: 'Optional: Service and endpoint name (e.g., github.get-user) to clear cache for. If omitted, clears all cache.',
                    type: 'string',
                });
            },
            async (argv) => {
                const isJsonOutput = argv.json || argv.quiet;
                try {
                    if (argv['service.endpoint']) {
                        // This part is tricky with flat-cache's API.
                        // flat-cache.clearCacheById(cacheId) clears a specific cache file.
                        // To clear by service/endpoint, we'd need a consistent cacheId generation
                        // that maps directly to service/endpoint, or iterate and delete.
                        // For simplicity in pseudocode, let's assume a direct mapping or a way to find it.
                        // A more robust solution might involve storing cache metadata or using a different caching strategy.

                        // Placeholder: In a real implementation, you'd need to determine the cache ID(s)
                        // associated with the service.endpoint and then clear them.
                        // For now, we'll just log a message.
                        printOutput({ type: 'message', data: `Attempting to clear cache for: ${argv['service.endpoint']}. (Detailed implementation needed for specific cache clearing)` }, isJsonOutput);
                        // Example: flatCache.clearCacheById(generateCacheId(argv['service.endpoint']));
                    } else {
                        flatCache.clearAll();
                        printOutput({ type: 'message', data: 'All Ovrmnd CLI cache cleared.' }, isJsonOutput);
                    }
                } catch (error) {
                    handleError(error, isJsonOutput);
                }
            }
        );
    }
).argv;
