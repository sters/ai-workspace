/**
 * Prompt template for workspace-repo-todo-planner agent.
 * Plans and creates TODO items for a specific repository.
 */

export interface PlannerInput {
  workspaceName: string;
  repoPath: string;
  repoName: string;
  readmeContent: string;
  worktreePath: string;
  taskType: string;
  interactive?: boolean;
}

export function buildPlannerPrompt(input: PlannerInput): string {
  return `# Task: Plan TODO items for ${input.repoName}

## Workspace: ${input.workspaceName}
## Repository: ${input.repoPath}
## Worktree: ${input.worktreePath}
## Task Type: ${input.taskType}
${input.interactive ? "## Mode: interactive" : ""}

## Workspace README

${input.readmeContent}

## TODO Template

${selectTemplate(input.taskType)}

## Instructions

${PLANNER_INSTRUCTIONS}
`;
}

function selectTemplate(taskType: string): string {
  switch (taskType.toLowerCase()) {
    case "feature":
    case "implementation":
      return TODO_FEATURE_TEMPLATE;
    case "bugfix":
    case "bug":
      return TODO_BUGFIX_TEMPLATE;
    case "research":
      return TODO_RESEARCH_TEMPLATE;
    default:
      return TODO_DEFAULT_TEMPLATE;
  }
}

const PLANNER_INSTRUCTIONS = `You are a specialized agent for analyzing a repository and creating detailed TODO items. Your role is to understand the workspace objectives and the repository structure, then create actionable TODO items.

**Your mission is simple and unwavering: Analyze the repository and create a detailed TODO file.**

### Execution Steps

1. **Read Workspace Context** (provided above):
   - Understand what task needs to be accomplished
   - Identify task type, requirements, and acceptance criteria

2. **Use the TODO Template** (provided above):
   - Write the template to the workspace as the TODO file
   - Replace \`{{REPOSITORY_NAME}}\` with the actual repository name

3. **Analyze the Repository**:
   - Read documentation: CLAUDE.md, README.md, CONTRIBUTING.md
   - Understand project structure, tech stack, and tooling
   - Explore relevant code for the task

4. **Enhance TODO Items**:
   - Replace generic items with specific file paths and function names
   - Add exact build/test/lint commands from repository documentation
   - Break down "Implement code changes" into concrete, actionable steps
   - Add task-specific details from the workspace README

### Output

Write the TODO file to: workspace/{workspace-name}/TODO-{repository-name}.md

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### TODO Item Format

Each TODO item MUST follow this structured format:

\`\`\`markdown
- [ ] **[Target]** Action description
  - Target: \`path/to/file.go\` or "New file" or "Multiple files in dir/"
  - Action: Specific change to make (what to add/modify/remove)
  - Pattern: (optional) Reference to existing code pattern to follow
  - Verify: (optional) How to verify the change is correct
\`\`\`

### Guidelines

1. Focus on this repository only
2. Be actionable: each TODO should be something the executor can act on
3. Reference specific code: include file paths, function names, patterns
4. Include commands: specify exact build/test/lint commands
5. Match repository conventions
6. Order logically: dependencies first, then implementation, then tests

### Interactive Mode

If Mode is "interactive", pause at two checkpoints:
1. After analysis, present findings and proposed approach (ask user before creating TODOs)
2. After creating draft TODOs, present for review (ask user before finalizing)
`;

const TODO_FEATURE_TEMPLATE = `# TODO: {{REPOSITORY_NAME}}

## Initialize

- [ ] **[README.md]** Read repository documentation
  - Target: \`README.md\`
  - Action: Understand project overview, setup, and development workflow

- [ ] **[CLAUDE.md]** Read AI-specific instructions (if exists)
  - Target: \`CLAUDE.md\`
  - Action: Identify build/test/lint commands and coding conventions

- [ ] **[CONTRIBUTING.md]** Read contribution guidelines (if exists)
  - Target: \`CONTRIBUTING.md\`
  - Action: Understand PR process and code style requirements

## Implementation Tasks

- [ ] **[TBD]** (Replace with specific implementation tasks)
  - Target: (Specify exact file path)
  - Action: (Describe exactly what to add/modify)
  - Pattern: (Reference existing similar code if applicable)

- [ ] **[TBD]** (Replace with specific test tasks)
  - Target: (Specify test file path)
  - Action: (Describe test cases to add)
  - Verify: (Specify test command)

## Verification

- [ ] **[Repository]** Run test suite
  - Target: Repository root
  - Action: Execute test command from CLAUDE.md/README.md or \`make test\`
  - Verify: All tests pass

- [ ] **[Repository]** Run linter
  - Target: Repository root
  - Action: Execute lint command from CLAUDE.md/README.md or \`make lint\`
  - Verify: No lint errors

## Finalize

- [ ] **[Git]** Commit changes
  - Target: Git repository
  - Action: Review \`git log\` for commit message style, then commit with descriptive message

## Notes

<!-- Add any notes, blockers, dependencies, or additional context here -->
`;

const TODO_BUGFIX_TEMPLATE = `# TODO: {{REPOSITORY_NAME}}

## Initialize

- [ ] **[README.md]** Read repository documentation
  - Target: \`README.md\`
  - Action: Understand project overview, setup, and development workflow

- [ ] **[CLAUDE.md]** Read AI-specific instructions (if exists)
  - Target: \`CLAUDE.md\`
  - Action: Identify build/test/lint commands and coding conventions

## Bug Investigation

- [ ] **[TBD]** Reproduce the bug locally
  - Target: (Specify file/endpoint/component where bug occurs)
  - Action: (Describe exact steps to reproduce)
  - Verify: (Describe expected vs actual behavior)

- [ ] **[TBD]** Identify root cause
  - Target: (Specify suspected file/function)
  - Action: (Describe what to investigate)

## Bug Fix Tasks

- [ ] **[TBD]** (Replace with specific fix implementation)
  - Target: (Specify exact file path)
  - Action: (Describe exactly what to change and why)

- [ ] **[TBD]** Add regression test
  - Target: (Specify test file path)
  - Action: (Describe test case that would have caught this bug)
  - Verify: Test fails without fix, passes with fix

## Verification

- [ ] **[Repository]** Run test suite
  - Target: Repository root
  - Action: Execute test command from CLAUDE.md/README.md or \`make test\`
  - Verify: All tests pass (including new regression test)

- [ ] **[Repository]** Run linter
  - Target: Repository root
  - Action: Execute lint command from CLAUDE.md/README.md or \`make lint\`
  - Verify: No lint errors

## Finalize

- [ ] **[Git]** Commit changes
  - Target: Git repository
  - Action: Review \`git log\` for commit message style, then commit with descriptive message

## Notes

<!-- Add any notes, blockers, dependencies, or additional context here -->
`;

const TODO_RESEARCH_TEMPLATE = `# TODO: {{REPOSITORY_NAME}}

## Initialize

- [ ] **[README.md]** Read repository documentation
  - Target: \`README.md\`
  - Action: Understand project overview and architecture

- [ ] **[CLAUDE.md]** Read AI-specific instructions (if exists)
  - Target: \`CLAUDE.md\`
  - Action: Identify project conventions and tooling

## Research Tasks

- [ ] **[TBD]** (Replace with specific investigation task)
  - Target: (Specify files/docs to analyze)
  - Action: (Describe what to find out)

## Documentation

- [ ] **[Workspace README.md]** Document findings
  - Target: Workspace README.md
  - Action: Add research findings under a Findings section

## Notes

<!-- Add any notes, blockers, or additional context here -->
`;

const TODO_DEFAULT_TEMPLATE = `# TODO: {{REPOSITORY_NAME}}

## Initialize

- [ ] **[README.md]** Read repository documentation
  - Target: \`README.md\`
  - Action: Understand project overview, setup, and development workflow

- [ ] **[CLAUDE.md]** Read AI-specific instructions (if exists)
  - Target: \`CLAUDE.md\`
  - Action: Identify build/test/lint commands and coding conventions

## Tasks

- [ ] **[TBD]** (Replace with specific task)
  - Target: (Specify exact file/component)
  - Action: (Describe exactly what to do)

## Verification

- [ ] **[Repository]** Run test suite (if applicable)
  - Target: Repository root
  - Action: Execute test command from CLAUDE.md/README.md
  - Verify: All tests pass

## Notes

<!-- Add any notes, blockers, dependencies, or additional context here -->
`;
