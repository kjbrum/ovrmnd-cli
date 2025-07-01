# Task: T-04 - Implement CLI Command: `call`

**Phase:** 2: Core API Execution
**Status:** `Not Started`

## Objective

Implement the core `call` command, which will execute API requests based on the loaded YAML configurations. This command will integrate the YAML parsing, schema validation, parameter mapping, and authentication handling to perform HTTP requests and return responses. **Note:** The "Batch Support" feature (F-03) will be deferred to a later phase due to its complexity and to maintain focus on core single-call functionality in Phase 2.

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Definition:**
    -   Use `yargs` to define the `call` command, expecting a positional argument for `<service.endpoint>` (e.g., `ovrmnd call github.get-user`).
    -   Configure `yargs` to capture all subsequent arguments as key-value pairs (e.g., `--username=octocat`, `--repo=my-repo`). These will be dynamically passed to the parameter mapping logic.
-   **Argument Validation:**
    -   Perform basic validation on the `<service.endpoint>` argument to ensure it's in the correct format.

### 2. Configuration Retrieval and Validation

-   **Load Configurations:**
    -   Utilize the `loadConfigurations()` function (from T-01) to get all available service configurations.
-   **Extract Service and Endpoint:**
    -   Parse the `<service.endpoint>` string to extract the `serviceName` and `endpointName`.
    -   Retrieve the specific `serviceConfig` and `endpointDefinition` from the loaded configurations.
-   **Validate Schema:**
    -   Call the `validateSchema()` function (from T-02) on the retrieved `serviceConfig` to ensure its structural integrity.

### 3. Parameter Mapping

-   **Map Arguments:**
    -   Call the `mapParameters()` function (from T-02) with the `endpointDefinition` and the parsed CLI arguments.
    -   This will return the `finalPath`, `body`, `query`, and `headers` ready for the HTTP request.

### 4. Authentication Application

-   **Apply Credentials:**
    -   Call the `applyAuthentication()` function (from T-03) to add the necessary authentication headers or query parameters to the request configuration.

### 5. HTTP Request Execution with `axios`

-   **Request Construction:**
    -   Construct the `axios` request configuration object:
        -   `baseURL`: from `serviceConfig.baseUrl`.
        -   `method`: from `endpointDefinition.method`.
        -   `url`: the `finalPath` returned by `mapParameters`.
        -   `headers`: merged with authentication headers.
        -   `params`: the `query` object from `mapParameters`.
        -   `data`: the `body` object from `mapParameters` (for POST/PUT requests).
-   **Execution:**
    -   Execute the request using `axios(requestConfig)`.
-   **Error Handling:**
    -   Implement `try...catch` blocks to handle network errors, timeouts, and non-2xx HTTP responses. These errors should be caught and passed to the standardized error output (T-06).

### 6. Response Handling

-   **Process Response:**
    -   Upon successful response, pass the data to the dual-mode output function (T-05) for appropriate formatting and display.

## Pseudocode

```javascript
const axios = require('axios');
const yargs = require('yargs');
// Assume loadConfigurations, validateSchema, mapParameters, applyAuthentication are imported/available

yargs.command(
    'call <service.endpoint>', 
    'Execute an API request',
    (yargs) => {
        yargs.positional('service.endpoint', {
            describe: 'Service and endpoint name (e.g., github.get-user)',
            type: 'string',
        });
        yargs.strict(false); // Allow arbitrary --arg=value
    },
    async (argv) => {
        try {
            const [serviceName, endpointName] = argv['service.endpoint'].split('.');
            if (!serviceName || !endpointName) {
                throw new Error('Invalid service.endpoint format. Expected <service>.<endpoint>');
            }

            const allConfigs = loadConfigurations(); // From T-01
            const serviceConfig = allConfigs[serviceName];

            if (!serviceConfig) {
                throw new Error(`Service "${serviceName}" not found.`);
            }

            validateSchema(serviceConfig); // From T-02

            const endpointDefinition = serviceConfig.endpoints.find(e => e.name === endpointName);
            if (!endpointDefinition) {
                throw new Error(`Endpoint "${endpointName}" not found for service "${serviceName}".`);
            }

            const { finalPath, body, query, headers } = mapParameters(endpointDefinition, argv); // From T-02

            const requestConfig = {
                baseURL: serviceConfig.baseUrl,
                method: endpointDefinition.method,
                url: finalPath,
                headers: headers,
                params: query,
                data: body,
            };

            applyAuthentication(requestConfig, serviceConfig); // From T-03

            const response = await axios(requestConfig);
            // Pass response to dual-mode output (T-05)
            console.log(JSON.stringify(response.data, null, 2)); // Placeholder for T-05

        } catch (error) {
            // Pass error to standardized error output (T-06)
            console.error(JSON.stringify({ success: false, error: { code: error.code, message: error.message, details: error.response?.data || {} } }, null, 2)); // Placeholder for T-06
        }
    }
).argv;
```
