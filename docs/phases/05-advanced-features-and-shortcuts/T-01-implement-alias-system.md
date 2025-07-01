# Task: T-01 - Implement Alias System (F-15)

**Phase:** 5: Advanced Features & Shortcuts
**Status:** `Not Started`

## Objective

Implement an alias system that allows users to define shortcuts for common API calls within their YAML configurations. This system will enable users to create more concise and memorable commands, improving the overall developer experience.

## Technical Plan

### 1. Schema Extension

-   **Service Configuration YAML:** Extend the service configuration YAML schema to include an optional `aliases` array at the top level of a service definition.
-   **Alias Object Structure:** Each object within the `aliases` array will have the following structure:
    -   `name` (string, required): The name of the alias (e.g., `me`, `activeUsers`).
    -   `endpoint` (string, required): The name of the existing endpoint within the same service that this alias refers to.
    -   `args` (object, optional): A key-value pair object where keys are parameter names and values are their pre-defined values. These arguments will be merged with any arguments provided directly on the command line, with command-line arguments taking precedence.

### 2. Alias Resolution Logic

-   **`resolveAlias(serviceConfig, aliasName, cliArgs)` Function:**
    -   Create a utility function that takes the `serviceConfig`, the `aliasName` (the second part of `service.endpoint` if it's an alias), and the `cliArgs` (arguments from `yargs`).
    -   This function will first search for an alias with the given `aliasName` within the `serviceConfig.aliases` array.
    -   If an alias is found:
        -   Retrieve the `endpoint` name referenced by the alias.
        -   Retrieve the `args` pre-defined in the alias.
        -   Merge the alias's `args` with the `cliArgs`, ensuring that `cliArgs` override any conflicting values from the alias.
        -   Return an object containing the resolved `endpointName` and the merged `args`.
    -   If no alias is found, assume the `aliasName` was actually an `endpointName` and return it along with the original `cliArgs`.

### 3. Integration with `call` Command (Phase 2, T-04)

-   **Modify `call` Command Handler:**
    -   In the `call` command's `yargs` handler, after parsing `serviceName` and `endpointName` (which might be an alias name):
        -   Call the `resolveAlias` function to determine the actual `endpointName` and the final set of arguments to use for the API call.
        -   Pass these resolved values to the existing `mapParameters` function (from Phase 2, T-02) and subsequent request execution logic.

### 4. Validation (Extension of Phase 3, T-02 - `validate` command)

-   **Extend `validate` Command Logic:**
    -   When validating a service configuration, if an `aliases` array is present:
        -   **Endpoint Existence:** For each alias, verify that the `endpoint` it references actually exists within the `serviceConfig.endpoints` array.
        -   **Parameter Mapping:** For each `arg` defined within an alias, check if it corresponds to a valid parameter (path, query, body, or header) of the referenced endpoint.
        -   **Required Parameters:** Ensure that all *required* parameters of the referenced endpoint are either present in the alias's `args` or are explicitly marked as optional in the endpoint definition (if applicable).
    -   Report any alias-related validation errors using the standardized error output mechanism.

## Pseudocode

```javascript
// Assume loadConfigurations, validateSchema, mapParameters, applyAuthentication, printOutput, handleError are imported/available

// Extend the main yargs command setup
yargs.command(
    'call <service.endpoint>',
    'Execute an API request or an alias',
    (yargs) => {
        yargs.positional('service.endpoint', {
            describe: 'Service and endpoint name (e.g., github.get-user) or alias (e.g., github.me)',
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

            const allConfigs = loadConfigurations();
            const serviceConfig = allConfigs[serviceName];

            if (!serviceConfig) {
                throw new Error(`Service "${serviceName}" not found.`);
            }

            validateSchema(serviceConfig); // From T-02, Phase 2

            let resolvedEndpointName = endpointOrAliasName;
            let resolvedArgs = { ...argv }; // Start with all CLI args

            // Check if endpointOrAliasName is an alias
            const aliasDefinition = serviceConfig.aliases && serviceConfig.aliases.find(a => a.name === endpointOrAliasName);

            if (aliasDefinition) {
                resolvedEndpointName = aliasDefinition.endpoint;
                // Merge alias args with CLI args, CLI args take precedence
                resolvedArgs = { ...aliasDefinition.args, ...argv };
            }

            const endpointDefinition = serviceConfig.endpoints.find(e => e.name === resolvedEndpointName);
            if (!endpointDefinition) {
                throw new Error(`Endpoint "${resolvedEndpointName}" not found for service "${serviceName}".`);
            }

            const { finalPath, body, query, headers } = mapParameters(endpointDefinition, resolvedArgs); // From T-02, Phase 2

            const requestConfig = {
                baseURL: serviceConfig.baseUrl,
                method: endpointDefinition.method,
                url: finalPath,
                headers: headers,
                params: query,
                data: body,
            };

            applyAuthentication(requestConfig, serviceConfig); // From T-03, Phase 2

            const response = await fetch(fullUrl, requestOptions);
            printOutput(await response.json(), isJsonOutput); // From T-05, Phase 2

        } catch (error) {
            handleError(error, isJsonOutput); // From T-06, Phase 2
        }
    }
).argv;

// --- Extension to validate command (Phase 3, T-02) pseudocode ---
// Inside the validate command's loop for each serviceConfig:
// ...
// Alias Validation
// if (serviceConfig.aliases) {
//     for (const alias of serviceConfig.aliases) {
//         const targetEndpoint = serviceConfig.endpoints.find(e => e.name === alias.endpoint);
//         if (!targetEndpoint) {
//             validationResults[serviceName].isValid = false;
//             validationResults[serviceName].errors.push(
//                 `Alias "${alias.name}": References non-existent endpoint "${alias.endpoint}".`
//             );
//             hasErrors = true;
//             continue;
//         }

//         // Validate alias arguments against target endpoint parameters
//         const targetEndpointParams = targetEndpoint.parameters || [];
//         const targetPathParams = (targetEndpoint.path.match(/\{([^\{}]+)\}/g) || []).map(p => p.slice(1, -1));

//         for (const argName in alias.args) {
//             const isExplicitParam = targetEndpointParams.some(p => p.name === argName);
//             const isPathParam = targetPathParams.includes(argName);

//             if (!isExplicitParam && !isPathParam) {
//                 validationResults[serviceName].isValid = false;
//                 validationResults[serviceName].errors.push(
//                     `Alias "${alias.name}": Argument "${argName}" does not map to a valid parameter for endpoint "${targetEndpoint.name}".`
//                 );
//                 hasErrors = true;
//             }
//         }

//         // Check for missing required parameters in alias args
//         for (const param of targetEndpointParams) {
//             if (param.required && !alias.args[param.name]) {
//                 validationResults[serviceName].isValid = false;
//                 validationResults[serviceName].errors.push(
//                     `Alias "${alias.name}": Missing required parameter "${param.name}" for endpoint "${targetEndpoint.name}".`
//                 );
//                 hasErrors = true;
//             }
//         }
//     }
// }
// ...
```