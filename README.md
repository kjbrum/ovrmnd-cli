# Ovrmnd CLI

**Status:** Under Development

## Vision

Ovrmnd CLI is a universal, lightweight command-line interface (CLI) designed to be a simple bridge between Large Language Models (LLMs) and any REST API. The goal is to empower LLMs and AI agents to interact with the digital world through APIs without requiring custom-built, service-specific servers or complex integrations.

## Core Features

*   **Declarative YAML Configuration:** Define API endpoints, parameters, and authentication in simple, shareable YAML files.
*   **Automatic Service Discovery:** The CLI automatically discovers API configurations from global and project-specific directories.
*   **Secure by Default:** Credentials are kept out of configuration and sourced from environment variables (`.env` files supported).
*   **LLM-Friendly Output:** Provides structured JSON output for easy parsing by AI agents.
*   **Built-in Caching:** Reduce redundant API calls with configurable caching for GET requests.
*   **Aliases:** Create simple shortcuts for complex or frequently used API calls.

## Getting Started

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run in development mode:
```bash
npm run dev
```

### Testing

```bash
npm test
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run TypeScript compiler in watch mode
- `npm test` - Run tests
- `npm run lint` - Lint the codebase
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
src/
├── commands/       # CLI commands
├── config/         # Configuration management
├── api/           # API client implementation
├── cache/         # Response caching
├── transform/     # Response transformation
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
```

## Available Commands

- `ovrmnd version` - Show version information
- More commands coming soon...

## Development Progress

See [docs/phases/PROGRESS.md](docs/phases/PROGRESS.md) for detailed implementation progress.
