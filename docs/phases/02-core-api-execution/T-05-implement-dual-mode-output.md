# Task: T-05 - Implement Dual-Mode Output

**Phase:** 2: Core API Execution
**Status:** `Not Started`

## Objective

Implement a dual-mode output system for the CLI, providing both human-friendly and machine-readable (JSON) formats. The output mode will be determined by the presence of `--json` or `--quiet` flags.

## Technical Plan

### 1. Detecting Output Mode

-   **`yargs` Configuration:**
    -   Modify the `yargs` setup to include two new boolean options:
        -   `--json`: When present, forces machine-readable JSON output.
        -   `--quiet`: When present, also forces machine-readable JSON output and suppresses any non-essential CLI output (e.g., loading spinners, informational messages).
    -   The presence of either `--json` or `--quiet` will set an internal flag (e.g., `isJsonOutput`) that dictates the output format.

### 2. Output Formatting Logic

-   **Centralized Output Function:**
    -   Create a utility function, `printOutput(data, isJsonOutput)`, that takes the data to be displayed and the `isJsonOutput` flag.
-   **Machine-Readable (JSON) Output:**
    -   If `isJsonOutput` is `true`:
        -   The `data` object will be converted to a JSON string using `JSON.stringify(data, null, 2)` for pretty-printing during development/debugging, or `JSON.stringify(data)` for a more compact output suitable for LLMs.
        -   This JSON string will be printed directly to `stdout`.
        -   No other UI elements (spinners, colors, etc.) should be displayed.
-   **Human-Friendly Output (Ink/React):**
    -   If `isJsonOutput` is `false`:
        -   The `data` will be passed to an `ink` React component for rendering.
        -   This component can display the data in a formatted, color-coded manner, potentially using tables for lists or syntax-highlighted JSON for objects.
        -   `ink` will manage the rendering to the terminal, including any loading indicators or interactive elements.

## Pseudocode

```javascript
// In your main CLI entry point (e.g., src/index.js) where yargs is configured
yargs.option('json', {
    type: 'boolean',
    describe: 'Output in JSON format',
    default: false,
});
yargs.option('quiet', {
    type: 'boolean',
    describe: 'Suppress non-essential output and output in JSON format',
    default: false,
});

// In your command handler (e.g., for the 'call' command)
async (argv) => {
    const isJsonOutput = argv.json || argv.quiet;

    try {
        // ... (API call logic from T-04)

        const responseData = response.data; // Assuming response is from axios

        if (isJsonOutput) {
            console.log(JSON.stringify(responseData, null, 2));
        } else {
            // Render with Ink/React
            const { render } = require('ink');
            const React = require('react');

            const App = ({ data }) => (
                <Box>
                    <Text color="green">Success!</Text>
                    <Text>{JSON.stringify(data, null, 2)}</Text>
                </Box>
            );
            
            // For a real Ink app, you'd have a more sophisticated component
            // and potentially manage state for loading, errors, etc.
            render(<App data={responseData} />);
        }

    } catch (error) {
        // Error handling will be passed to T-06
    }
}
```
