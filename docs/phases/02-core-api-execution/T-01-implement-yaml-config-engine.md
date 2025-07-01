# Task: T-01 - Implement YAML Config Engine

**Phase:** 2: Core API Execution
**Status:** `Not Started`

## Objective

Implement the core configuration loading mechanism for the Ovrmnd CLI. This engine will be responsible for discovering, reading, and parsing YAML configuration files from both a global (`~/.ovrmnd/`) and a local (`./.ovrmnd/`) directory, with local configurations overriding global ones.

## Technical Plan

### 1. Directory Discovery

-   **Global Directory:**
    -   Use the `os.homedir()` method from Node.js's built-in `os` module to get the user's home directory.
    -   Use the `path.join()` method from the `path` module to construct the full, cross-platform-compatible path to `~/.ovrmnd/`.
    -   Use `fs.existsSync()` to check if the directory exists. If not, the loader will simply ignore it.
-   **Local Directory:**
    -   Use `process.cwd()` to get the current working directory where the CLI is being executed.
    -   Use `path.join()` to construct the path to the `./ovrmnd/` directory.
    -   Use `fs.existsSync()` to check for its existence.

### 2. File Reading and Parsing

-   **File Discovery:**
    -   For each of the global and local directories, use `fs.readdir()` to get a list of all files.
    -   Filter this list to include only files with a `.yml` or `.yaml` extension.
-   **Parsing:**
    -   For each discovered YAML file, read its content using `fs.readFileSync()`.
    -   Use the `js-yaml.load()` method to parse the YAML content into a JavaScript object.
    -   Wrap the file reading and parsing logic in a `try...catch` block to gracefully handle potential file system errors or YAML syntax errors.

### 3. Configuration Merging and Overriding

-   **Loading Order:**
    1.  Load all global configurations into a single JavaScript object, where the keys are the `serviceName` and the values are the service configurations.
    2.  Load all local configurations into a separate object.
-   **Override Logic:**
    -   Use `Object.assign()` or the object spread syntax (`...`) to merge the local configurations over the global configurations. This ensures that if a service with the same name exists in both locations, the local version will take precedence.

## Pseudocode

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

function loadConfigurations() {
    const globalConfigPath = path.join(os.homedir(), '.ovrmnd');
    const localConfigPath = path.join(process.cwd(), '.ovrmnd');

    let globalConfigs = {};
    let localConfigs = {};

    if (fs.existsSync(globalConfigPath)) {
        globalConfigs = loadFromDirectory(globalConfigPath);
    }

    if (fs.existsSync(localConfigPath)) {
        localConfigs = loadFromDirectory(localConfigPath);
    }

    return { ...globalConfigs, ...localConfigs };
}

function loadFromDirectory(directoryPath) {
    const configs = {};
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            try {
                const filePath = path.join(directoryPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const parsedYaml = yaml.load(fileContent);
                if (parsedYaml && parsedYaml.serviceName) {
                    configs[parsedYaml.serviceName] = parsedYaml;
                }
            } catch (error) {
                console.error(`Error loading or parsing ${file}:`, error);
            }
        }
    }

    return configs;
}
```
