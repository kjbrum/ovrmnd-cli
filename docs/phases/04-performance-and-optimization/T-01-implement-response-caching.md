# Task: T-01 - Implement Response Caching (F-10)

**Phase:** 4: Performance & Optimization
**Status:** `Not Started`

## Objective

Implement a response caching mechanism for `GET` requests based on a configurable `cacheTTL` (Time To Live) specified in the YAML configuration. This will reduce redundant API calls and improve performance.

## Technical Plan

### 1. Cache Storage with `flat-cache`

-   **Initialization:**
    -   Utilize the `flat-cache` library to create and manage a file-based cache.
    -   The cache will be stored in a dedicated directory (e.g., `~/.cache/ovrmnd/`) to ensure persistence across CLI executions.
    -   Each service/endpoint combination will likely have its own cache instance or a unique key within a shared cache.
-   **Cache Key Generation:**
    -   Develop a consistent method to generate a unique cache key for each `GET` request.
    -   This key should be a hash of the full request URL (including query parameters), relevant headers (e.g., `Accept`, `Content-Type`), and potentially the request body if it's a `GET` request with a body (though less common).
    -   The key must be deterministic, meaning the same request always generates the same key.

### 2. Cache Read/Write Logic

-   **`getOrSetCache(key, ttl, fetchFunction)` Function:**
    -   Create a utility function that encapsulates the caching logic.
    -   It will first attempt to retrieve data from the cache using the generated `key`.
    -   If a valid (not expired) entry is found, it will return the cached data immediately.
    -   If no valid entry is found (cache miss or expired), it will execute the `fetchFunction` (which will be the actual API call).
    -   Upon successful completion of `fetchFunction`, the response data will be stored in the cache with the specified `ttl` before being returned.
-   **Expiration Handling:**
    -   `flat-cache` supports TTLs, so leverage its built-in expiration mechanisms.

### 3. Integration with `call` Command (Phase 2, T-04)

-   **Pre-Request Check:**
    -   In the `call` command's `yargs` handler, before making the `fetch` request:
        -   Check if the `endpointDefinition.method` is `GET`.
        -   Check if `endpointDefinition.cacheTTL` is defined and is a positive number.
        -   If both conditions are met, generate the cache key for the current request.
        -   Call the `getOrSetCache` function, passing the generated key, the `cacheTTL`, and an anonymous function that performs the actual `fetch` request.
-   **Response Handling:**
    -   The `getOrSetCache` function will return either the cached data or the fresh API response. This data will then be passed to the response transformation (T-03) and dual-mode output (T-05) functions.

### 4. Output and Error Handling Integration

-   **Debug Mode (Phase 3, T-03):**
    -   Integrate with the debug mode to log cache hits and misses, including the cache key and TTL.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors during cache operations (e.g., cache file corruption) should be caught and passed to the standardized error output function, though these should ideally not prevent the API call from proceeding.

## Pseudocode

```javascript
const flatCache = require('flat-cache');
const path = require('path');
const os = require('os');
const crypto = require('crypto'); // For generating cache keys
// Assume fetch, logDebug, printOutput, handleError are imported/available

// Define a consistent cache directory
const cacheDir = path.join(os.homedir(), '.cache', 'ovrmnd');

// Utility to generate a consistent cache key
function generateCacheKey(url, method, headers, params, data) {
    const hash = crypto.createHash('sha256');
    hash.update(url);
    hash.update(method);
    hash.update(JSON.stringify(headers));
    hash.update(JSON.stringify(params));
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
}

async function getOrSetCache(cacheId, key, ttl, fetchFunction) {
    const cache = flatCache.load(cacheId, cacheDir);
    const cachedEntry = cache.getKey(key);

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < ttl * 1000)) {
        logDebug(`Cache HIT for key: ${key}`);
        return cachedEntry.data;
    } else if (cachedEntry) {
        logDebug(`Cache EXPIRED for key: ${key}`);
        cache.removeKey(key);
        cache.save();
    }

    logDebug(`Cache MISS for key: ${key}. Fetching data...`);
    const freshData = await fetchFunction();
    cache.setKey(key, { data: freshData, timestamp: Date.now() });
    cache.save();
    logDebug(`Data cached for key: ${key} with TTL: ${ttl}s`);
    return freshData;
}

// Example integration in T-04 (call command) pseudocode:
// ...
// async (argv) => {
//     const isJsonOutput = argv.json || argv.quiet;
//     logDebug('Starting API call process...', { service: serviceName, endpoint: endpointName });
//     try {
//         // ... (config loading, validation, alias resolution)

//         const { finalPath, body, query, headers } = mapParameters(endpointDefinition, resolvedArgs);

//         const requestConfig = {
//             baseURL: serviceConfig.baseUrl,
//             method: endpointDefinition.method,
//             url: finalPath,
//             headers: headers,
//             params: query,
//             data: body,
//         };

//         applyAuthentication(requestConfig, serviceConfig);

//         let responseData;
//         if (endpointDefinition.method === 'GET' && endpointDefinition.cacheTTL) {
//             const cacheId = `${serviceName}-${resolvedEndpointName}`; // Unique cache per endpoint
//             const cacheKey = generateCacheKey(
//                 requestConfig.baseURL + requestConfig.url,
//                 requestConfig.method,
//                 requestConfig.headers,
//                 requestConfig.params,
//                 requestConfig.data
//             );
//             responseData = await getOrSetCache(cacheId, cacheKey, endpointDefinition.cacheTTL, async () => {
//                 const response = await fetch(requestUrl, requestOptions);
//                 return response.json();
//             });
//         } else {
//             const response = await fetch(requestUrl, requestOptions);
//             responseData = await response.json();
//         }

//         // Apply transformation if defined (from T-03, Phase 4)
//         // if (endpointDefinition.transform) {
//         //     responseData = applyTransformation(responseData, endpointDefinition.transform);
//         // }

//         printOutput(responseData, isJsonOutput);

//     } catch (error) {
//         handleError(error, isJsonOutput);
//     }
// }
```