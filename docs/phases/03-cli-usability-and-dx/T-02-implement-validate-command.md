# Task: T-02 - Implement CLI Command: `validate`

**Phase:** 3: CLI Usability & DX
**Status:** `Not Started`

## Objective

Implement the `validate` command to check YAML configuration files for syntax errors, missing required fields, parameter conflicts (e.g., path parameters redefined in the parameters list), and alias validation. This command will help developers ensure their configurations are correct and well-formed.

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Definition:**
    -   Define `ovrmnd validate` as a command.
    -   It will optionally accept a positional argument `<service>` to specify a single service to validate.
    -   If no service is provided, the command will validate all discovered configurations.
-   **Help Messages:**
    -   Provide clear help messages for the `validate` command.

### 2. Validation Logic

-   **Configuration Loading:**
    -   Utilize the `loadConfigurations()` function (from Phase 2, T-01) to retrieve all available service configurations.
-   **Iterative Validation:**
    -   If a `<service>` argument is provided, validate only that specific service.
    -   If no `<service>` is provided, iterate through all loaded service configurations and validate each one.
-   **Schema Validation (Extension of Phase 2, T-02):**
    -   Re-use and extend the `validateSchema()` function (from Phase 2, T-02) to perform the initial structural validation.
-   **Parameter Conflict Detection:**
    -   Within the endpoint validation logic, extract all path parameters from the `path` string (e.g., `{userId}`).
    -   Compare these extracted path parameter names against the `name` of any explicitly defined `parameters` within the endpoint.
    -   If a parameter name appears in both the path and the explicit `parameters` list, flag it as a conflict and report an error.
-   **Alias Validation (Requires F-15, Alias System):**
    -   If the service configuration includes `aliases` (from F-15, Phase 5), iterate through each alias.
    -   For each alias, verify that the `endpoint` it references actually exists within the same service.
    -   Check that all `args` provided in the alias correspond to valid parameters (path, query, body, header) of the referenced endpoint.
    -   Crucially, ensure that all *required* parameters of the referenced endpoint are present in the alias's `args`.

### 3. Reporting Results

-   **Collection of Results:**
    -   Maintain a collection of validation results, indicating for each service/endpoint/alias whether it passed or failed validation, along with any specific error messages.
-   **Output Integration:**
    -   Pass the collected validation results to the dual-mode output function (Phase 2, T-05).
    -   For human-friendly mode, display a summary of validation successes and failures, highlighting specific issues.
    -   For machine-readable mode, output a JSON object containing the detailed validation results for all checked configurations.
-   **Error Handling:**
    -   Any fundamental errors (e.g., configuration files unreadable, service not found) should be handled by the standardized error output function (Phase 2, T-06).

## Pseudocode

```javascript
const yargs = require('yargs');
// Assume loadConfigurations, validateSchema (extended), printOutput, handleError are imported/available

yargs.command(
    'validate [service]',
    'Validate YAML configuration files',
    (yargs) => {
        yargs.positional('service', {
            describe: 'Optional: The name of the service to validate. If omitted, all services will be validated.',
            type: 'string',
        });
    },
    async (argv) => {
        const isJsonOutput = argv.json || argv.quiet;
        const validationResults = {};
        let hasErrors = false;

        try {
            const allConfigs = loadConfigurations();
            const servicesToValidate = argv.service ? { [argv.service]: allConfigs[argv.service] } : allConfigs;

            for (const serviceName in servicesToValidate) {
                const serviceConfig = servicesToValidate[serviceName];
                validationResults[serviceName] = { isValid: true, errors: [] };

                try {
                    // Basic schema validation (from T-02, Phase 2)
                    validateSchema(serviceConfig);

                    // Parameter Conflict Detection
                    for (const endpoint of serviceConfig.endpoints) {
                        const pathParams = (endpoint.path.match(/\{([^{}]+)\}/g) || []).map(p => p.slice(1, -1));
                        if (endpoint.parameters) {
                            for (const param of endpoint.parameters) {
                                if (pathParams.includes(param.name)) {
                                    validationResults[serviceName].isValid = false;
                                    validationResults[serviceName].errors.push(
                                        `Endpoint "${endpoint.name}": Parameter "${param.name}" is defined in both path and parameters list.`
                                    );
                                    hasErrors = true;
                                }
                            }
                        }
                    }

                    // Alias Validation (assuming F-15 is implemented)
                    if (serviceConfig.aliases) {
                        for (const alias of serviceConfig.aliases) {
                            const targetEndpoint = serviceConfig.endpoints.find(e => e.name === alias.endpoint);
                            if (!targetEndpoint) {
                                validationResults[serviceName].isValid = false;
                                validationResults[serviceName].errors.push(
                                    `Alias "${alias.name}": References non-existent endpoint "${alias.endpoint}".`
                                );
                                hasErrors = true;
                                continue;
                            }

                            // Check if alias args match endpoint parameters
                            // This is a simplified check; a full implementation would compare types and required status
                            for (const argName in alias.args) {
                                const paramExists = targetEndpoint.parameters && targetEndpoint.parameters.some(p => p.name === argName);
                                const isPathParam = (targetEndpoint.path.match(/\{([^{}]+)\}/g) || []).includes(`{${argName}}`);
                                if (!paramExists && !isPathParam) {
                                    validationResults[serviceName].isValid = false;
                                    validationResults[serviceName].errors.push(
                                        `Alias "${alias.name}": Argument "${argName}" does not map to a valid parameter for endpoint "${targetEndpoint.name}".`
                                    );
                                    hasErrors = true;
                                }
                            }

                            // Check for required parameters in alias args
                            const allTargetParams = [...(targetEndpoint.parameters || []), ...targetPathParams.map(p => ({ name: p, required: true, type: 'path' }))];
                            for (const param of allTargetParams) {
                                if (param.required && !alias.args[param.name]) {
                                    validationResults[serviceName].isValid = false;
                                    validationResults[serviceName].errors.push(
                                        `Alias "${alias.name}": Missing required parameter "${param.name}" for endpoint "${targetEndpoint.name}".`
                                    );
                                    hasErrors = true;
                                }
                            }
                        }
                    }

                } catch (error) {
                    validationResults[serviceName].isValid = false;
                    validationResults[serviceName].errors.push(error.message);
                    hasErrors = true;
                }
            }

            printOutput({ type: 'validationResults', data: validationResults, overallSuccess: !hasErrors }, isJsonOutput);

        } catch (error) {
            handleError(error, isJsonOutput);
        }
    }
).argv;
```
