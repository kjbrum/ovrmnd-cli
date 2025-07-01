# Learnings

This file documents important learnings and findings from interactions with the Gemini CLI agent.

## General

- Decided to defer the use of `ink` for UI and rely solely on `yargs` for CLI command parsing and basic output. This simplifies initial development, as the primary goal is machine-readable output for LLMs, not an interactive human-friendly UI at this stage.

## Coding

- Switched from `axios` to native Node.js `fetch` for HTTP requests. This reduces the dependency footprint and leverages built-in capabilities.
- Changed the default configuration file locations to `~/.ovrmnd/` and `./.ovrmnd/` for global and local configurations, respectively.
