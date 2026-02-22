/**
 * Prompt template for workspace-repo-todo-updater agent.
 * Updates TODO items in a workspace repository.
 */

export interface UpdaterInput {
  workspaceName: string;
  repoName: string;
  readmeContent: string;
  todoContent: string;
  worktreePath: string;
  workspacePath: string;
  instruction: string;
  interactive?: boolean;
}

export function buildUpdaterPrompt(input: UpdaterInput): string {
  return `# Task: Update TODO items for ${input.repoName}

## Workspace: ${input.workspaceName}
## Workspace Path: ${input.workspacePath}
## Repository Worktree: ${input.worktreePath}
${input.interactive ? "## Mode: interactive" : ""}

## Update Request

${input.instruction}

## Workspace README

${input.readmeContent}

## Current TODO File (TODO-${input.repoName}.md)

${input.todoContent}

## Instructions

${UPDATER_INSTRUCTIONS}
`;
}

const UPDATER_INSTRUCTIONS = `You are a specialized agent for updating TODO items in a workspace repository. Your role is to apply user-requested changes to the TODO file.

**Your mission: Apply the requested changes to the TODO file.**

### Execution Steps

1. **Understand Update Request**:
   - Add: New TODO items to add
   - Remove: Existing items to remove (only uncompleted)
   - Modify: Items to change

2. **Analyze Repository** (for abstract Add requests):
   - If the request is abstract, analyze the repository to create specific items
   - If already concrete (includes file paths), proceed directly

3. **Apply Updates**:
   - **ALWAYS delete completed TODO items** (\`[x]\`) to keep file compact
   - Preserve overall structure and formatting style
   - New items MUST follow the structured format

4. **Commit Changes**:
   - Stage and commit TODO file changes in the workspace git repo

### TODO Item Format (Required)

\`\`\`markdown
- [ ] **[Target]** Action description
  - Target: \`path/to/file\` or "New file"
  - Action: Specific change to make
  - Pattern: (optional) Reference to existing code
  - Verify: (optional) How to verify
\`\`\`

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### Interactive Mode

If Mode is "interactive", preview changes before applying and ask for user approval.

### Guidelines

1. Auto-compact: always remove completed items
2. Match style: follow existing formatting conventions
3. Be precise: only make requested changes
4. Validate: ensure valid markdown after updates
`;
