# Task: T-03 - Implement Response Transformation

**Phase:** 4: Performance & Optimization
**Status:** `Not Started`

## Objective

Implement the ability to transform API responses based on user-defined rules. This includes extracting specific fields, renaming fields, and potentially re-structuring the response, allowing users to tailor the output to their needs.

## Technical Plan

### 1. Defining Transformation Rules in YAML

-   **Schema Extension:** Extend the endpoint definition in the YAML schema to include an optional `transform` object.
-   **`transform` Object Structure:**
    -   `extract`: An array of strings, where each string is a dot-notation path to a field to extract (e.g., `user.profile.name`). If only `extract` is present, the output will be an array of the extracted values, or an object where keys are the full dot-notation paths if multiple fields are extracted.
    -   `rename`: An object where keys are new field names and values are dot-notation paths to original fields (e.g., `newName: user.profile.name`). This allows renaming and flattening. (Note: This corresponds to the `map` concept in the pseudocode).
    -   `template`: (Advanced, optional for V1) A string representing a template (e.g., using a templating language like Handlebars or a simple string interpolation) to construct a custom output string or object.

### 2. Transformation Logic

-   **`applyTransformation(responseData, transformRules)` Function:**
    -   Create a utility function that takes the raw API `responseData` (JSON object) and the `transformRules` (the `transform` object from the YAML).
-   **Extraction Logic:**
    -   If `transformRules.extract` is present:
        -   Iterate through the `extract` array.
        -   For each path, use a utility function (e.g., `lodash.get` or a custom implementation) to safely retrieve the value from `responseData`.
        -   Collect all extracted values into an array or a new object, depending on the desired output structure.
-   **Mapping/Renaming Logic:**
    -   If `transformRules.map` is present:
        -   Create a new empty object for the transformed response.
        -   Iterate through the `map` object.
        -   For each `newField: originalPath` pair, retrieve the value from `responseData` using `originalPath` and assign it to `newField` in the new transformed object.
-   **Combination:**
    -   If both `extract` and `map` are present, define a clear precedence or merging strategy. A common approach is to apply `extract` first to narrow down the data, then `map` to restructure it.

### 3. Integration with `call` Command

-   **Post-Response Processing:**
    -   In the `call` command (Phase 2, T-04), after receiving a successful `axios` response and before passing it to the dual-mode output (Phase 2, T-05):
        -   Check if the `endpointDefinition` has a `transform` object.
        -   If it does, call `applyTransformation(response.data, endpointDefinition.transform)`.
        -   Pass the *transformed* data to the dual-mode output function.

### 4. Output and Error Handling Integration

-   **Dual-Mode Output (Phase 2, T-05):**
    -   The transformed data will be passed to the dual-mode output function, ensuring it's displayed correctly in both human-friendly and machine-readable formats.
-   **Standardized Error Output (Phase 2, T-06):**
    -   Any errors during transformation (e.g., invalid paths in `extract` or `map` rules) should be caught and passed to the standardized error output function.

## Pseudocode

```javascript
// Utility function to safely get nested property (can be replaced by lodash.get)
function getNestedProperty(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function applyTransformation(responseData, transformRules) {
    if (!transformRules) {
        return responseData; // No transformation rules, return original data
    }

    let transformedData = responseData;

    if (transformRules.extract) {
        const extractedValues = {};
        for (const path of transformRules.extract) {
            const value = getNestedProperty(responseData, path);
            // If multiple fields are extracted, store them in an object where keys are the full dot-notation paths
            // or the last part of the path if it's unique. For simplicity, let's use the full path as key.
            extractedValues[path] = value;
        }
        transformedData = extractedValues;
    }

    if (transformRules.rename) { // Changed from map to rename for consistency with PRD
        const renamedData = {};
        for (const newField in transformRules.rename) {
            const originalPath = transformRules.rename[newField];
            renamedData[newField] = getNestedProperty(transformedData, originalPath);
        }
        transformedData = renamedData;
    }

    // Add template logic here if implemented in V2

    return transformedData;
}

// Example integration in T-04 (call command) pseudocode:
// ...
// const response = await axios(requestConfig);
// let responseData = response.data;

// if (endpointDefinition.transform) {
//     try {
//         responseData = applyTransformation(responseData, endpointDefinition.transform);
//     } catch (transformError) {
//         // Handle transformation errors, e.g., log and potentially fall back to original data
//         console.error("Error applying transformation:", transformError);
//         // Optionally, re-throw or pass to standardized error output
//     }
// }

// Pass responseData to dual-mode output (T-05)
// console.log(JSON.stringify(responseData, null, 2)); // Placeholder for T-05
// ...
```