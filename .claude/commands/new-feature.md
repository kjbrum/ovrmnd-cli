# New Feature Command

<goal>
Research and plan implementation of a new feature for the Ovrmnd CLI by thoroughly understanding requirements, investigating technical approaches, and creating comprehensive documentation and high-level implementation plans.
</goal>

<instructions>
You are tasked with planning a new feature for the Ovrmnd CLI project. This command emphasizes thorough research and planning before implementation. Ultrathink throughout this process - be thorough and consider various approaches. Follow these steps precisely:

1. **Break Down Research Into Tasks**
   - Use TodoWrite to create a task list for your research:
     - Understanding requirements
     - Architecture analysis
     - Technical research
     - Implementation planning
     - Documentation creation
   - This helps track progress and ensures thorough coverage

2. **Understand Feature Requirements**
   - Parse the feature description provided by the user
   - Identify key requirements and constraints
   - Determine which phase this feature belongs to or if it should be a new phase (check `docs/phases/PROGRESS.md`)
   - List any assumptions that need validation
   - Consider enterprise use cases and edge scenarios

3. **Analyze Current Architecture**
   - Read project documentation:
     - Look for additional context in `docs/` directories
     - `CLAUDE.md` for project overview and conventions
     - `docs/phases/PROGRESS.md` for current implementation status
     - `docs/phase-breakdown.md` for planned phases
     - `docs/product-requirements-doc-ovrmnd-cli.md` for overall vision
   - Search codebase for related functionality:
     - Authentication patterns in `src/api/auth.ts`
     - Configuration handling in `src/config/`
     - Service patterns in `src/services/`
   - Identify integration points and potential conflicts
   - Keep track of important files discovered during research

4. **Research Technical Approaches (Use Parallel Research)**
   - Use Task tool to run multiple research tasks in parallel when possible:
   - Use WebSearch to research:
     - Best practices for the feature type
     - Common implementation patterns
     - Security considerations
     - Performance implications
   - For API/SDK integrations:
     - Search for official documentation
     - Look for TypeScript SDK examples
     - Check authentication patterns
     - Review rate limiting and quotas
   - For architectural changes:
     - Research design patterns
     - Look for similar CLI implementations
     - Consider extensibility and maintenance

5. **Think Through Implementation**
   - Consider multiple implementation approaches
   - Evaluate trade-offs:
     - Complexity vs flexibility
     - Performance vs simplicity
     - User experience vs implementation effort
   - Think about:
     - Error handling and edge cases
     - Backward compatibility
     - Testing strategy
     - Security implications
     - Configuration requirements

6. **Create Feature Plan Document**
   - Create a new markdown file: `docs/plans/{feature-name}.md`
   - Use this structure:
     ```markdown
     # {Feature Name} - Phase {X} Enhancement

     ## Overview
     {Brief description of the feature and its purpose}

     ## Requirements
     - {Key requirement 1}
     - {Key requirement 2}
     - {etc.}

     ## Technical Approach
     ### Option 1: {Approach Name}
     {Description of approach}

     **Pros:**
     - {Advantage 1}
     - {Advantage 2}

     **Cons:**
     - {Disadvantage 1}
     - {Disadvantage 2}

     ### Option 2: {Alternative Approach}
     {Description}

     ### Recommended Approach
     {Which option and why}

     ## Implementation Details
     ### File Structure
     ```
     src/
       {new directories/files}
     ```

     ### Core Components
     1. **{Component Name}**
        - Purpose: {what it does}
        - Location: `src/{path}`
        - Key methods/interfaces

     ### Configuration Changes
     {YAML structure additions/changes}

     ### API/SDK Integration
     {Specific integration details}

     ## Code Changes (High Level)
     ### New Files
     - `src/{path}` - {purpose}

     ### Modified Files
     - `src/{path}` - {what changes}

     ### Example Usage
     ```bash
     # Command examples
     ```

     ## Security Considerations
     - {Security concern 1}
     - {How it's addressed}

     ## Testing Strategy
     - Unit tests for {components}
     - Integration tests for {workflows}
     - Manual testing scenarios

     ## Documentation Updates
     - README.md - {what to add}
     - CLAUDE.md - {what to update}
     - User guides needed

     ## Migration/Upgrade Path
     {How existing users upgrade}


     ## Important Files
     List of key files discovered during research:
     - `src/path/file.ts` - {purpose}
     - `docs/path/file.md` - {context}

     ## Future Considerations
     {What this enables for future}
     ```

7. **Update Project Documentation**
   - Update `docs/phases/PROGRESS.md`:
     - Add new phase if needed
     - Add feature to appropriate phase task list
     - Update phase descriptions
   - Update `docs/phase-breakdown.md`:
     - Add detailed requirements to appropriate phase
     - Update phase objectives if needed
   - Consider updating:
     - `README.md` if feature affects user-facing functionality
     - `CLAUDE.md` if feature changes development workflow

8. **Generate Implementation Checklist**
   - Create a detailed task list for actual implementation:
     - Core functionality tasks
     - Test implementation tasks
     - Documentation tasks
     - Integration tasks
   - Estimate complexity and effort
   - Identify dependencies and blockers

9. **Present Summary to User**
   - Summarize the feature plan
   - Highlight key decisions and trade-offs
   - Show file paths created/updated
   - Ask if they want to proceed with implementation planning
</instructions>

<additional_notes>
- This command focuses on planning, not implementation
- Always create the feature plan document before updating other docs
- Consider enterprise needs (proxies, authentication, security)
- Research thoroughly - better to over-research than under-research
- Think about extensibility for future enhancements
- For API integrations, always check for official SDKs first
- Consider the user experience for configuration and setup
- Document security implications clearly
- Use concrete examples in the feature plan
- Use batch processing and Task tool for parallel research when possible
- Ultrathink to consider all angles and approaches
- Track important files discovered during research
- Your only task is to gather context and come up with a plan
</additional_notes>
