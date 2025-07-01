# Task: T-03 - Implement CLI Command: `init`

**Phase:** 5: Advanced Features & Shortcuts
**Status:** `Not Started`

## Objective

Implement the `init` command to generate template YAML configuration files for new services. This command will help users quickly bootstrap new API configurations with a predefined structure, reducing manual setup and ensuring consistency.

## Technical Plan

### 1. CLI Argument Parsing with `yargs`

-   **Command Definition:**
    -   Define `ovrmnd init <service-name>` as a command.
    -   It will take a positional argument `<service-name>` for the name of the new service (which will also be the filename).
    -   Optionally, allow a `--template` flag to specify a different template if multiple are available (e.g., `ovrmnd init my-new-api --template=advanced`). For V1, we will only have a `default-service.yaml` template.
-   **Help Messages:**
    -   Provide clear and concise help messages for the `init` command.

### 2. Template Management

-   **Template Directory:**
    -   Store template YAML files in a dedicated directory within the CLI's project structure (e.g., `src/templates/`).
    -   For V1, we will have a `default-service.yaml` template.
-   **Template Selection:**
    -   Based on the `--template` flag (or defaulting to `default-service.yaml`), determine which template file to use.

### 3. File Generation Logic

-   **Target Directory:**
    -   The generated YAML file will be placed in the local project's `ovrmnd/` directory (`./ovrmnd/`). If this directory does not exist, the command should create it.
-   **File Naming:**
    -   The generated file will be named `<service-name>.yaml`.
-   **Content Copying/Templating:**
    -   Read the content of the selected template file.
    -   For V1, the template will be a static YAML file. Future versions could introduce templating engines to inject dynamic values (e.g., `serviceName`).
    -   Write the content to the new file in the `./ovrmnd/` directory.
-   **Conflict Handling:**
    -   If a file with the same `<service-name>.yaml` already exists in the target directory, prompt the user for confirmation before overwriting it. If the user declines, abort the operation.
-   **`.gitignore` Entry:**
    -   If a `.env` file is created or referenced by the template, the `init` command should automatically add `/.env` to the project's `.gitignore` file if it's not already present, to ensure sensitive data is not committed to version control.

### 4. Output and Error Handling

-   **Success Message:**
    -   Upon successful generation, inform the user that the file has been created and its location.
-   **Dual-Mode Output (Phase 2, T-05):**
    -   All output from the `init` command (success messages, prompts) should be passed to the dual-mode output function.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors encountered (e.g., template not found, file system errors, user declining overwrite) should be caught and passed to the standardized error output function.

## Pseudocode

```javascript
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
// Assume printOutput, handleError are imported/available

yargs.command(
    'init <service-name>',
    'Generate a template YAML configuration file for a new service.',
    (yargs) => {
        yargs.positional('service-name', {
            describe: 'The name of the new service (e.g., my-new-api)',
            type: 'string',
        });
        yargs.option('template', {
            describe: 'Specify a template to use (e.g., default).', // For V1, only 'default' is supported implicitly
            type: 'string',
            default: 'default',
        });
    },
    async (argv) => {
        const isJsonOutput = argv.json || argv.quiet;
        const serviceName = argv['service-name'];
        const templateName = argv.template;

        const templatesDir = path.join(__dirname, '..', 'templates'); // Assuming this command is in src/commands
        const templateFilePath = path.join(templatesDir, `${templateName}-service.yaml`); // For V1, this will be default-service.yaml
        const targetDir = path.join(process.cwd(), 'ovrmnd');
        const targetFilePath = path.join(targetDir, `${serviceName}.yaml`);

        try {
            if (!fs.existsSync(templateFilePath)) {
                throw new Error(`Template '${templateName}' not found at ${templateFilePath}.`);
            }

            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
                printOutput({ type: 'message', data: `Created directory: ${targetDir}` }, isJsonOutput);
            }

            // Check for existing file and prompt for overwrite
            if (fs.existsSync(targetFilePath)) {
                // In a real CLI, you'd use an interactive prompt library like 'inquirer'
                // For pseudocode, we'll simulate a decision or throw an error.
                const confirmOverwrite = true; // Simulate user confirmation
                if (!confirmOverwrite) {
                    printOutput({ type: 'message', data: `Operation cancelled. File '${serviceName}.yaml' already exists.` }, isJsonOutput);
                    return;
                }
                printOutput({ type: 'message', data: `Overwriting existing file: ${targetFilePath}` }, isJsonOutput);
            }

            const templateContent = fs.readFileSync(templateFilePath, 'utf8');
            fs.writeFileSync(targetFilePath, templateContent);

            printOutput({ type: 'success', data: `Successfully created '${serviceName}.yaml' at ${targetFilePath}` }, isJsonOutput);

        } catch (error) {
            handleError(error, isJsonOutput); // From T-06, Phase 2
        }
    }
).argv;
```