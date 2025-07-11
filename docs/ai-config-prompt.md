# AI Configuration Prompt

This file loads the modular XML-based prompt structure for AI configuration generation.

The prompt is now composed of multiple XML files in the `docs/prompts/` directory:
- `ai-config-base.xml` - Main prompt with XML structure
- `security-rules.xml` - Security requirements
- `examples/` - Service-specific examples and patterns

The actual prompt content is loaded from `docs/prompts/ai-config-base.xml`.