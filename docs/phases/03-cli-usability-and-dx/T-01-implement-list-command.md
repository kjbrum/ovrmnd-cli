# Task: T-01 - Implement CLI Command: `list`

**Phase:** 3: CLI Usability & DX
**Status:** `Not Started`

## Objective

Implement the `list` command to help users discover available services, endpoints within a service, and aliases for a service. This command will provide valuable insights into the configured API interactions.

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Structure:**
    -   Define `ovrmnd list` as a parent command.
    -   Implement subcommands:
        -   `services`: `ovrmnd list services`
        -   `endpoints <service>`: `ovrmnd list endpoints github`
        -   `aliases <service>`: `ovrmnd list aliases github`
-   **Positional Arguments:**
    -   For `endpoints` and `aliases` subcommands, define a positional argument `<service>` to specify the service name.
-   **Help Messages:**
    -   Provide clear and concise help messages for each command and subcommand.

### 2. Information Retrieval and Display

-   **Load Configurations:**
    -   Utilize the `loadConfigurations()` function (from Phase 2, T-01) to retrieve all available service configurations.
-   **`list services` Logic:**
    -   Iterate through the loaded configurations and extract the `serviceName` from each.
    -   Display these service names. If no services are found, display an appropriate message.
-   **`list endpoints <service>` Logic:**
    -   Retrieve the specified `serviceConfig` based on the `<service>` argument.
    -   If the service is found, iterate through its `endpoints` array.
    -   For each endpoint, display its `name`, HTTP `method`, and `path`. Consider also displaying a summary of its `parameters` (e.g., required arguments).
    -   If the service or its endpoints are not found, display an informative error message.
-   **`list aliases <service>` Logic:**
    -   Retrieve the specified `serviceConfig` based on the `<service>` argument.
    -   If the service is found and has an `aliases` array (assuming F-15, Alias System, is implemented or will be), iterate through it.
    -   For each alias, display its `name`, the `endpoint` it references, and its preconfigured `args`.
    -   If the service or its aliases are not found, display an informative message.

### 3. Output and Error Handling Integration

-   **Dual-Mode Output (Phase 2, T-05):**
    -   All output from the `list` command (lists of services, endpoints, aliases) should be passed to the dual-mode output function.
    -   This ensures that the output is formatted correctly for both human-readable (console/basic formatting) and machine-readable (JSON) modes based on the `--json` or `--quiet` flags.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors encountered (e.g., service not found, invalid arguments) should be caught and passed to the standardized error output function.
    -   This ensures consistent error reporting across the CLI.

## Pseudocode

```javascript
const yargs = require('yargs');
// Assume loadConfigurations, printOutput, handleError are imported/available

yargs.command(
    'list', 
    'List available services, endpoints, or aliases',
    (yargs) => {
        yargs.command(
            'services',
            'List all configured services',
            async (argv) => {
                try {
                    const allConfigs = loadConfigurations();
                    const serviceNames = Object.keys(allConfigs);
                    if (serviceNames.length > 0) {
                        printOutput({ type: 'services', data: serviceNames }, argv.json || argv.quiet);
                    } else {
                        printOutput({ type: 'message', data: 'No services configured.' }, argv.json || argv.quiet);
                    }
                } catch (error) {
                    handleError(error, argv.json || argv.quiet);
                }
            }
        );

        yargs.command(
            'endpoints <service>',
            'List all endpoints for a specific service',
            (yargs) => {
                yargs.positional('service', {
                    describe: 'The name of the service',
                    type: 'string',
                });
            },
            async (argv) => {
                try {
                    const allConfigs = loadConfigurations();
                    const serviceConfig = allConfigs[argv.service];

                    if (!serviceConfig) {
                        throw new Error(`Service "${argv.service}" not found.`);
                    }

                    if (serviceConfig.endpoints && serviceConfig.endpoints.length > 0) {
                        const formattedEndpoints = serviceConfig.endpoints.map(ep => {
                            const params = (ep.parameters || []).map(p => {
                                return `${p.name} (${p.type}${p.required ? ', required' : ''})`;
                            }).join(', ');
                            const pathParams = (ep.path.match(/\{([^\{}]+)\}/g) || []).map(p => p.slice(1, -1) + ' (path, required)').join(', ');
                            const allParams = [pathParams, params].filter(Boolean).join(', ');
                            return {
                                name: ep.name,
                                method: ep.method,
                                path: ep.path,
                                parameters: allParams || 'None'
                            };
                        });
                        printOutput({ type: 'endpoints', service: argv.service, data: formattedEndpoints }, argv.json || argv.quiet);
                    } else {
                        printOutput({ type: 'message', data: `No endpoints found for service "${argv.service}".` }, argv.json || argv.quiet);
                    }
                } catch (error) {
                    handleError(error, argv.json || argv.quiet);
                }
            }
        );

        yargs.command(
            'aliases <service>',
            'List all aliases for a specific service',
            (yargs) => {
                yargs.positional('service', {
                    describe: 'The name of the service',
                    type: 'string',
                });
            },
            async (argv) => {
                try {
                    const allConfigs = loadConfigurations();
                    const serviceConfig = allConfigs[argv.service];

                    if (!serviceConfig) {
                        throw new Error(`Service "${argv.service}" not found.`);
                    }

                    if (serviceConfig.aliases && serviceConfig.aliases.length > 0) {
                        printOutput({ type: 'aliases', service: argv.service, data: serviceConfig.aliases }, argv.json || argv.quiet);
                    } else {
                        printOutput({ type: 'message', data: `No aliases found for service "${argv.service}".` }, argv.json || argv.quiet);
                    }
                } catch (error) {
                    handleError(error, argv.json || argv.quiet);
                }
            }
        );
    }
).argv;
```
