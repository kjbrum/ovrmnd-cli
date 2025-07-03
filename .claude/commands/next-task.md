# Next Task Command

<goal>
Continue working on the Ovrmnd CLI project by checking progress, researching the next phase/task, breaking it into smaller todos, and systematically implementing it.
</goal>

<instructions>
You are an expert Software Engineer working on the Ovrmnd CLI project. Follow these steps precisely to continue development:

1. **Check Current Progress**
   - Read `docs/phases/PROGRESS.md` to understand:
     - Current phase and completion percentage
     - Completed tasks
     - Next uncompleted tasks
     - Current focus area
   - Identify the next logical task to work on

2. **Gather Context**
   - Read relevant documentation:
     - `docs/phase-breakdown.md` for detailed phase requirements
     - `docs/product-requirements-doc-ovrmnd-cli.md` for full product specs
     - `CLAUDE.md` for project conventions and guidelines
   - Review existing code structure in `src/` to understand patterns
   - Check test files in `tests/` to understand testing approach

3. **Identify and Confirm Next Task**
   - Based on `PROGRESS.md`, identify the specific next task(s) to implement
   - Present a clear summary to the user:
     - Current completion status
     - What task(s) you plan to work on
     - Why this is the logical next step
   - **IMPORTANT**: Ask for confirmation before proceeding
   - Example: "Based on the progress, the next task is to implement the 'call' command. This involves creating the command handler, integrating the HTTP client, and formatting output. Should I proceed with this?"
   - Wait for explicit user confirmation before moving forward

4. **Research Next Task**
   - Once confirmed, search for relevant files and patterns in the codebase
   - If needed, perform web searches for:
     - Library documentation (e.g., yargs, fetch, js-yaml)
     - Best practices for the specific feature
     - Common implementation patterns

5. **Create Todo List**
   - Use TodoWrite to break down the task into smaller, manageable steps
   - Include steps for:
     - Implementation
     - Unit tests
     - Integration tests (if applicable)
     - Documentation updates
     - Linting and formatting
   - Prioritize tasks logically (e.g., interfaces before implementation)

6. **Execute Implementation**
   - Mark first todo as in_progress
   - Implement following these principles:
     - Write TypeScript with strict types (no `any`)
     - Follow existing code patterns and conventions
     - Write tests alongside implementation
     - Handle errors gracefully with helpful messages
   - After each subtask:
     - Run relevant tests
     - Run linting: `npm run lint`
     - Run type checking: `npm run typecheck`
     - Mark todo as completed if successful

7. **Update Progress**
   - After completing significant work:
     - Update `docs/phases/PROGRESS.md` with:
       - Completed task checkboxes
       - Updated percentages
       - Current focus section
       - Implementation notes
     - Update `LEARNINGS.md` with any insights or decisions
   - Commit changes if explicitly requested by user

8. **Iterate**
   - Continue with next todo item
   - If blocked, document the issue and ask for guidance
   - Regularly check todos to ensure you're on track

**Key Commands**:
```bash
npm run build       # Compile TypeScript
npm run dev         # Development mode
npm test            # Run all tests
npm run lint        # Check code style
npm run typecheck   # TypeScript type checking
npm run format      # Format code with Prettier
```
</instructions>

<additional_notes>
- Phase 2 is currently in progress (65% complete)
- Authentication and HTTP client are implemented
- Next major tasks: Call command implementation and output formatting
- Always update `PROGRESS.md` after completing tasks
- Use existing patterns from implemented features
- Prioritize MVP functionality over advanced features
</additional_notes>
