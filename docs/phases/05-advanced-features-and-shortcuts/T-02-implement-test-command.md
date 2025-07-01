# Task: T-02 - Implement CLI Command: `test`

**Phase:** 5: Advanced Features & Shortcuts
**Status:** `Not Started`

## Objective

Implement the `test` command to perform dry runs of API calls. This command will validate the configuration, map arguments, apply authentication (without sending the actual request), and display the constructed HTTP request details (URL, method, headers, body) to the user. **Crucially, this command will bypass any caching mechanisms.**

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Definition:**
    -   Define `ovrmnd test <service.endpoint>` as a command.
    -   It will take a positional argument `<service.endpoint>` (e.g., `myapi.getUser`).
    -   It will accept dynamic arguments for API parameters (e.g., `--id=123`, `--name="John Doe"`). Use `yargs.strict(false)` to allow arbitrary arguments.
-   **Help Messages:**
    -   Provide clear and concise help messages for the `test` command.

### 2. Configuration Loading and Resolution

-   **Load Configurations:**
    -   Utilize the `loadConfigurations()` function (from Phase 2, T-01) to retrieve all available service configurations.
-   **Extract Service and Endpoint:**
    -   Parse the `<service.endpoint>` argument to extract the `serviceName` and `endpointName`.
    -   Retrieve the specific `serviceConfig` and `endpointDefinition` from the loaded configurations.
-   **Alias Resolution (if F-15 is implemented):**
    -   If the alias system (F-15) is implemented, integrate the `resolveAlias` function (from Phase 5, T-01) to handle cases where `<service.endpoint>` refers to an alias.

### 3. Request Construction and Simulation

-   **Parameter Mapping:**
    -   Call the `mapParameters()` function (from Phase 2, T-02) with the `endpointDefinition` and the parsed CLI arguments (including any resolved from aliases).
    -   This will return the `finalPath`, `body`, `query`, and `headers` that would be used in an actual HTTP request.
-   **Authentication Application:**
    -   Call the `applyAuthentication()` function (from Phase 2, T-03) to add the necessary authentication headers or query parameters to a simulated request configuration. Crucially, ensure that sensitive tokens/keys are *not* logged directly, but rather indicate their presence (e.g., `Authorization: Bearer [TOKEN_PRESENT]`).
-   **Simulated Request Object:**
    -   Construct a JavaScript object representing the full HTTP request, including:
        -   `method`: from `endpointDefinition.method`.
        -   `url`: the `finalPath` combined with `baseUrl` and `query` parameters.
        -   `headers`: merged with authentication headers.
        -   `body`: the `body` object (for POST/PUT requests).

### 4. Output and Error Handling

-   **Display Dry Run Details:**
    -   Print the constructed simulated request object to `stdout` in a structured JSON format (using `JSON.stringify(dryRunDetails, null, 2)`).
    -   Clearly indicate that this is a dry run and no actual API request was sent.
-   **Dual-Mode Output (Phase 2, T-05):**
    -   Integrate with the dual-mode output system to ensure the dry run details are formatted correctly for both human-readable and machine-readable (JSON) modes based on `--json` or `--quiet` flags.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors encountered (e.g., service not found, endpoint not found, invalid arguments, authentication issues) should be caught and passed to the standardized error output function.

## Pseudocode

```javascript
const yargs = require('yargs');
// Assume loadConfigurations, validateSchema, mapParameters, applyAuthentication, printOutput, handleError, resolveAlias (if F-15) are imported/available

yargs.command(
    'test <service.endpoint>',
    'Perform a dry run of an API call to validate the configuration.',
    (yargs) => {
        yargs.positional('service.endpoint', {
            describe: 'The service and endpoint to test (e.g., myapi.getUser)',
            type: 'string',
        });
        yargs.strict(false); // Allow arbitrary --arg=value
    },
    async (argv) => {
        const isJsonOutput = argv.json || argv.quiet;
        try {
            const [serviceName, endpointOrAliasName] = argv['service.endpoint'].split('.');
            if (!serviceName || !endpointOrAliasName) {
                throw new Error('Invalid service.endpoint format. Expected <service>.<endpoint> or <service>.<alias>');
            }

            const allConfigs = loadConfigurations(); // From T-01, Phase 2
            const serviceConfig = allConfigs[serviceName];

            if (!serviceConfig) {
                throw new Error(`Service "${serviceName}" not found.`);
            }

            validateSchema(serviceConfig); // From T-02, Phase 2

            let resolvedEndpointName = endpointOrAliasName;
            let resolvedArgs = { ...argv };

            // Alias Resolution (if F-15 is implemented)
            // const aliasResolution = resolveAlias(serviceConfig, endpointOrAliasName, argv); // From T-01, Phase 5
            // if (aliasResolution.isAlias) {
            //     resolvedEndpointName = aliasResolution.endpointName;
            //     resolvedArgs = aliasResolution.args;
            // }

            const endpointDefinition = serviceConfig.endpoints.find(e => e.name === resolvedEndpointName);
            if (!endpointDefinition) {
                throw new Error(`Endpoint "${resolvedEndpointName}" not found for service "${serviceName}".`);
            }

            const { finalPath, body, query, headers } = mapParameters(endpointDefinition, resolvedArgs); // From T-02, Phase 2

            const simulatedRequestConfig = {
                baseURL: serviceConfig.baseUrl,
                method: endpointDefinition.method,
                url: finalPath,
                headers: headers,
                params: query,
                data: body,
            };

            // Apply authentication to the simulated request config
            // IMPORTANT: The applyAuthentication function (or a dedicated helper for the test command)
            // should ensure that sensitive values (like actual tokens/API keys) are replaced with
            // placeholders (e.g., `[TOKEN_PRESENT]`) in the `simulatedRequestConfig.headers` or `params`
            // before being displayed in the dry run output.
            applyAuthentication(simulatedRequestConfig, serviceConfig); // From T-03, Phase 2

            // Construct the full URL for display
            let fullUrl = `${simulatedRequestConfig.baseURL}${simulatedRequestConfig.url}`;
            if (Object.keys(simulatedRequestConfig.params).length > 0) {
                const queryString = new URLSearchParams(simulatedRequestConfig.params).toString();
                fullUrl += `?${queryString}`;
            }

            const dryRunDetails = {
                method: simulatedRequestConfig.method,
                url: fullUrl,
                headers: simulatedRequestConfig.headers,
            };

            if (simulatedRequestConfig.data && Object.keys(simulatedRequestConfig.data).length > 0) {
                dryRunDetails.body = simulatedRequestConfig.data;
            }

            printOutput({ type: 'dryRun', data: dryRunDetails, message: 'Dry run complete. No actual API request was sent.' }, isJsonOutput); // From T-05, Phase 2

        } catch (error) {
            handleError(error, isJsonOutput); // From T-06, Phase 2
        }
    }
).argv;
```