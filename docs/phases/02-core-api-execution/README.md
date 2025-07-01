# Phase 2: Core API Execution

**Status:** `Planning Complete`

## Overview

This phase focuses on implementing the absolute minimum required to make a single, authenticated API call. It includes setting up the YAML configuration engine, defining the schema, handling authentication, and executing the `call` command. The goal is to have a functional CLI that can interact with a REST API.

## Task List

| Task ID | Description                                                                                                                            | Status      |
| :------ | :------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| T-01    | **Implement YAML Config Engine (F-01):** Load and parse YAML files from global and local directories.                                  | `Planned` |
| T-02    | **Define YAML Schema (F-02):** Implement the logic to handle the `serviceName`, `baseUrl`, `authentication`, and `endpoints` schema.      | `Planned` |
| T-03    | **Implement Authentication (F-09):** Handle Bearer Token and API Key authentication, sourcing credentials from environment variables.      | `Planned` |
| T-04    | **Implement `call` Command (F-03):** Create the `call` command to execute API requests based on the YAML configuration.                  | `Planned` |
| T-05    | **Implement Dual-Mode Output (F-12):** Create both human-friendly and machine-readable (JSON) output formats.                            | `Planned` |
| T-06    | **Implement Standardized Error Output (F-13):** Ensure all errors are output in a structured JSON format.                               | `Planned` |

## Progress

- **T-01: Implement YAML Config Engine (F-01):** `Planned`
- **T-02: Define YAML Schema (F-02):** `Planned`
- **T-03: Implement Authentication (F-09):** `Planned`
- **T-04: Implement `call` Command (F-03):** `Planned`
- **T-05: Implement Dual-Mode Output (F-12):** `Planned`
- **T-06: Implement Standardized Error Output (F-13):** `Planned`
