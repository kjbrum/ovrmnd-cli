# Gemini Memory

This document outlines the plan for building "Ovrmnd CLI," a universal, lightweight command-line interface (CLI) designed to act as a simple bridge between Large Language Models (LLMs) and any REST API. Its primary goal is to enable AI agents to interact with external systems through APIs using a straightforward, configuration-based approach, removing the need for custom-built servers or complex integrations.

## IMPORTANT

- **Before starting any work**, check `docs/phases/PROGRESS.md` to understand the current status and priorities.
- **After you change the file structure, update documents, or make any changes**, this `GEMINI.md` file should be updated to stay up-to-date.
- **After completing any work**, update `docs/phases/PROGRESS.md` to reflect the changes and progress made.
- **When changes are made to files**, ensure any important documentation or related files are updated accordingly, including `README.md`.
- **After you've completed a task or request**, reflect on feedback the user provided and what worked or didn't work. Update the `LEARNINGS.md` file with any important learnings or findings you made so you can learn and get better over time. This shouldn't be used to track product decisions or general updates.

## Core Concepts

- **YAML-based Configuration:** Developers will define API interactions in simple, declarative YAML files. These files will specify the service's `baseUrl`, `authentication` method, and a list of `endpoints`.
- **Service Discovery:** The CLI will automatically discover these YAML files from both a global (`~/.ovrmnd/`) and a local project (`./.ovrmnd/`) directory.
- **Machine-Readable Output:** A key design principle is providing structured JSON output (when using `--json` or `--quiet` flags) for LLMs to reliably parse API responses and errors.
- **Secure Credential Management:** API keys and tokens will be handled securely by sourcing them from environment variables (including support for `.env` files), never from the YAML configurations themselves.

## Planned Features for the LLM Agent

As an AI agent, you will be able to use the Ovrmnd CLI to perform various actions. Here are the primary commands that are planned:

- **`ovrmnd call <service.endpoint> --arg=value`**: This will be the main command to execute an API request. Arguments will be passed as flags.
- **`ovrmnd list services`**: Will show all available services to interact with.
- **`ovrmnd list endpoints <service>`**: Will list all the available endpoints (actions) for a specific service, including their required arguments.
- **`ovrmnd list aliases <service>`**: Will list pre-configured shortcuts for common API calls.
- **`ovrmnd test <service.endpoint>`**: Will allow performing a dry run of an API call to validate the configuration.
- **`ovrmnd cache clear [service.endpoint]`**: Will clear the cache for an endpoint.

## Proposed Technical Stack

- **Platform:** NodeJS (LTS)
- **Package Manager:** npm
- **Key Libraries:** `yargs` (for CLI commands), `js-yaml` (for config parsing), `dotenv` (for environment variables), `flat-cache` (for caching), and native `fetch` for HTTP requests. (Note: `ink` for human-friendly UI is deferred for later consideration.)

## Documentation

### yargs

- API: https://github.com/yargs/yargs/blob/main/docs/api.md
- TypeScript: https://github.com/yargs/yargs/blob/main/docs/typescript.md
- Advanced usage: https://github.com/yargs/yargs/blob/main/docs/advanced.md
