/**
 * Prompt template for workspace-repo-todo-executor agent.
 * Executes TODO items for a specific repository within a workspace.
 */

export interface ExecutorInput {
  workspaceName: string;
  repoPath: string;
  repoName: string;
  readmeContent: string;
  todoContent: string;
  worktreePath: string;
}

export function buildExecutorPrompt(input: ExecutorInput): string {
  return `# Task: Execute TODO items for ${input.repoName}

## Workspace: ${input.workspaceName}
## Repository: ${input.repoPath}
## Worktree: ${input.worktreePath}

## Workspace README

${input.readmeContent}

## TODO File (TODO-${input.repoName}.md)

${input.todoContent}

## Instructions

${executorInstructions(input.worktreePath)}
`;
}

function executorInstructions(worktreePath: string): string {
  return `You are a specialized agent for executing TODO items for a specific repository within a workspace directory. Your role is to autonomously consume and complete TODO tasks defined in the TODO file above.

**Your mission is simple and unwavering: Complete all uncompleted items in the TODO file above.**

### TODO Item Status Markers

| Marker | Status |
|--------|--------|
| \`- [ ]\` | Pending (uncompleted) |
| \`- [~]\` | In progress |
| \`- [x]\` | Completed |
| \`- [!]\` | Blocked |

### Execution Steps

1. **Understand the repository** (read documentation first):
   - Read repository documentation: README.md, CLAUDE.md, CONTRIBUTING.md
   - Check current git branch and status
   - Check for Makefile and identify available targets
   - Identify the tech stack and correct commands for build, test, lint

2. **Work through TODO items sequentially** (top to bottom):
   - Before starting each item, optionally mark as in-progress: \`- [ ]\` -> \`- [~]\`
   - After completing each item:
     - **IMPORTANT**: Read the TODO file again before updating it (it may have been modified by other processes)
     - Update the TODO file immediately: \`- [ ]\` -> \`- [x]\`
     - Commit your changes if applicable
   - If blocked:
     - Mark the item as blocked: \`- [ ]\` -> \`- [!]\`
     - Document the blocker in the Notes section
     - Move to the next item

3. **Code Changes**:
   - Check repository's development methodology first (CLAUDE.md, CONTRIBUTING.md, README.md)
   - If no methodology specified, use TDD (Test-Driven Development)
   - Small, focused commits after completing logical units of work
   - Run tests and linter after changes
   - Follow existing code style and commit message patterns

4. **Git Workflow**:
   - The repository worktree is already on a feature/fix branch
   - Check repository conventions for commit message format
   - If no format specified, use clear descriptive messages starting with a verb

5. **Testing and Linting** (follow this priority):
   - Repository documentation commands first
   - Makefile targets second
   - Language-specific defaults last

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

Examples:
\`\`\`bash
git -C ${worktreePath} status
git -C ${worktreePath} add -A
\`\`\`

### Scope Boundaries

**DO**:
- Work only on files within the repository worktree
- Complete TODO items as specified
- Make commits to the feature/fix branch

**DO NOT**:
- Modify files outside the workspace/repository
- Push to remote (unless explicitly requested)
- Merge branches

### Error Handling

1. Build/Compile errors: Fix them before proceeding
2. Test failures: Investigate and fix, or document as blocker
3. Merge conflicts: Document and request human intervention
4. Missing dependencies: Run install commands

### Communication

- Always read the TODO file before updating it
- Update the TODO file frequently to show progress
- Add notes to the Notes section for important findings
`;
}
