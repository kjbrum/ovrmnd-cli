# Task: T-06 - Implement Standardized Error Output

**Phase:** 2: Core API Execution
**Status:** `Not Started`

## Objective

Implement a standardized error output mechanism that ensures all errors (network, authentication, API-specific, validation, etc.) are presented in a consistent, machine-readable JSON format when the `--json` or `--quiet` flags are active. For human-friendly mode, provide clear and concise error messages.

## Technical Plan

### 1. Define Standardized Error Schema

-   **Schema Structure:** All errors will conform to the following JSON structure:

    ```json
    {
      "success": false,
      "error": {
        "code": "string",
        "message": "string",
        "details": {}
      }
    }
    ```

-   **Field Definitions:**
    -   `success`: Always `false` for error responses.
    -   `error.code`: A concise, machine-readable string representing the error type (e.g., `NETWORK_ERROR`, `AUTH_ERROR`, `API_ERROR`, `VALIDATION_ERROR`, `UNKNOWN_ERROR`).
    -   `error.message`: A human-readable summary of the error.
    -   `error.details`: An object containing additional context relevant to the error. This might include:
        -   HTTP status code (`response.status` for `fetch` errors).
-   API-specific error response data (`response.json()` for `fetch` errors).
        -   Validation error specifics.
        -   Stack trace (potentially only in debug mode).

### 2. Centralized Error Handling Function

-   **`handleError(error, isJsonOutput)` Function:**
    -   Create a utility function that will be called whenever an error occurs within the CLI.
    -   It will receive the raw `error` object (e.g., from a `try...catch` block or `axios` catch) and the `isJsonOutput` flag (from T-05).
-   **Error Type Detection and Mapping:**
    -   **`axios` Errors:**
        -   Check `error.isAxiosError`.
        -   If it's a network error (e.g., `error.code === 'ECONNABORTED'`, `error.code === 'ENOTFOUND'`), map to `NETWORK_ERROR`.
        -   If it's an HTTP error (e.g., `error.response`), map to `API_ERROR`. Extract `error.response.status` and `error.response.data` into `details`.
    -   **Custom Validation Errors:**
        -   Errors thrown by schema validation (T-02) or parameter mapping should be caught and mapped to `VALIDATION_ERROR`.
    -   **Authentication Errors:**
        -   Errors thrown by authentication handling (T-03) should be mapped to `AUTH_ERROR`.
    -   **Generic Errors:**
        -   Any other unhandled JavaScript errors will be mapped to `UNKNOWN_ERROR`.
-   **Output Generation:**
    -   **Machine-Readable (JSON):**
        -   If `isJsonOutput` is `true`, construct the standardized JSON error object and print it to `stderr` (to keep `stdout` clean for successful JSON output).
    -   **Human-Friendly:**
        -   If `isJsonOutput` is `false`, display a user-friendly error message to `stderr`. This could involve using `console.error` to render a red-colored error message, potentially with a brief explanation and a suggestion for troubleshooting.

## Pseudocode

```javascript
// In your main CLI entry point or a dedicated error handler module
function handleError(error, isJsonOutput) {
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unexpected error occurred.';
    let errorDetails = {};

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Network error (e.g., no internet, DNS error)
        errorCode = 'NETWORK_ERROR';
        errorMessage = 'Network Error: Could not connect to the API.';
        errorDetails = {
            message: error.message,
        };
    } else if (error.message.includes('Authentication failed')) { // Simple check for now, refine later
        errorCode = 'AUTH_ERROR';
        errorMessage = error.message;
    } else if (error.message.includes('Invalid service.endpoint') || error.message.includes('not found')) { // Example validation errors
        errorCode = 'VALIDATION_ERROR';
        errorMessage = error.message;
    } else {
        // Generic JavaScript error
        errorMessage = error.message;
        errorDetails = { stack: error.stack };
    }

    const standardizedError = {
        success: false,
        error: {
            code: errorCode,
            message: errorMessage,
            details: errorDetails,
        },
    };

    if (isJsonOutput) {
        console.error(JSON.stringify(standardizedError, null, 2));
    } else {
        // Human-friendly output (using Ink/React for a real app)
        console.error(`Error: ${errorMessage}`);
        if (Object.keys(errorDetails).length > 0) {
            console.error('Details:', errorDetails);
        }
    }
}

// Example usage in T-04's catch block:
// } catch (error) {
//     handleError(error, argv.json || argv.quiet);
// }
```
