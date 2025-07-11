# New Command Command

<goal>
Create a new command file in the `./.claude/commands` directory with proper structure, clear instructions, and appropriate sections based on user requirements.
</goal>

<instructions>
You are tasked with creating a new command file for Claude Code. Follow these steps precisely:

1. **Understand the Command Purpose**
   - Ask the user for:
     - Command name (will become the filename)
     - Primary goal of the command
     - Key steps or workflow the command should follow
     - Any specific tools or approaches required
   - If not provided, ask clarifying questions before proceeding

2. **Research Existing Commands**
   - Check `~/.claude/commands/` for similar commands
   - Review command patterns and structures
   - Identify common sections and formatting
   - Note any project-specific conventions

3. **Plan Command Structure**
   - Create a clear, concise <goal> section (1-2 sentences)
   - Outline main steps for <instructions> section
   - Determine if <additional_notes> are needed
   - Consider if examples would be helpful

4. **Confirm Command Design**
   - Present a summary to the user:
     - Proposed filename: `{command-name}.md`
     - Goal statement
     - High-level workflow (3-5 main steps)
   - Ask: "Does this capture what you need? Any adjustments?"
   - Wait for confirmation before creating the file

5. **Create Command File**
   - Use the following template structure:
   ```markdown
   # {Command Title}

   <goal>
   {Clear, concise statement of what this command accomplishes}
   </goal>

   <instructions>
   {Detailed step-by-step instructions, typically including:}

   1. **{First Major Step}**
      - {Substep with specific actions}
      - {Additional details or requirements}
      - {Error handling or edge cases}

   2. **{Second Major Step}**
      - {Clear, actionable substeps}
      - {Tools to use or commands to run}
      - {Expected outcomes}

   3. **{Continue with additional steps...}**

   {Include any specific commands, code blocks, or examples}
   </instructions>

   <additional_notes>
   - {Important reminders or warnings}
   - {Context about when to use this command}
   - {Related commands or workflows}
   </additional_notes>
   ```

6. **Apply Best Practices**
   - Use clear, imperative language ("Do X" not "You should do X")
   - Number main steps, use bullets for substeps
   - Include specific tool names (e.g., "Use TodoWrite tool")
   - Add code blocks for commands or examples
   - Make instructions explicit and unambiguous
   - Consider error cases and decision points

7. **Review and Refine**
   - Ensure goal aligns with instructions
   - Check that all steps are actionable
   - Verify no assumptions about user knowledge
   - Add any project-specific requirements
   - Include relevant file paths or commands

8. **Save and Confirm**
   - Write file to appropriate location:
     - Project-specific: `./.claude/commands/{name}.md`
     - Global: `~/.claude/commands/{name}.md`
   - Show user the created file path
   - Offer to make adjustments if needed
</instructions>

<additional_notes>
- Command names should be kebab-case (e.g., `start-task.md`, `new-command.md`)
- Keep goals concise - they set expectations quickly
- Instructions should be self-contained - assume no prior context
- Use consistent formatting with other commands in the project
- Consider adding examples for complex workflows
- Test the command mentally - could someone follow it step-by-step?
</additional_notes>
