---
name: workspace-init
description: "Use when the user wants to start working on a task, ticket, or feature. Triggered by: ticket URLs (Jira, GitHub Issues, Linear, etc.), task descriptions, or requests like 'work on this', 'implement X', 'fix X', 'これをすすめて', 'これやって'. IMPORTANT: Before creating a new workspace, ALWAYS run /workspace-list first to check if a workspace already exists for the same ticket/task. If one exists, use /workspace-execute or /workspace-show-status instead. Creates workspace with README, clones repos, and plans TODO items via agents."
---

# workspace-init

## Overview

This skill initializes a working environment for development tasks. It orchestrates:
1. Workspace directory setup (via `setup-workspace.sh`)
2. Repository addition with worktrees (via `setup-repository.sh`)
3. README creation with task details
4. TODO planning for each repository (via workspace-repo-todo-planner agent)
5. Cross-repository coordination (via workspace-todo-coordinator agent)
6. TODO validation and clarification (via workspace-repo-todo-reviewer agent)

**After initialization:** Use `/workspace-execute` to work through TODO items and complete the task.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files (README.md, TODO files), use paths like:
- `workspace/{workspace-name}/README.md`
- `workspace/{workspace-name}/TODO-{repository-name}.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Understand the Task Requirements

Before running the setup scripts, ensure you have:

- Task type (feature, bugfix, research, etc.)
- Brief description
- Target repository path(s) in org/repo format (e.g., github.com/sters/ai-workspace)
- Ticket ID (optional)

**Note:** Base branch is automatically detected from the remote default (main/master). You don't need to specify it.

**Alias syntax:** If you need to use the same repository multiple times (e.g., separate PRs for dev/prod environments), use the `:alias` suffix:
- `github.com/org/repo:dev` → Creates worktree at `github.com/org/repo___dev/`
- `github.com/org/repo:prod` → Creates worktree at `github.com/org/repo___prod/`

### 2. Run Setup Scripts

#### Step 2a: Create Workspace

Execute the workspace setup script:

```bash
./.claude/skills/workspace-init/scripts/setup-workspace.sh <task-type> <description> [ticket-id]
```

**Examples:**

```bash
# Basic usage
./.claude/skills/workspace-init/scripts/setup-workspace.sh feature user-auth

# With ticket ID
./.claude/skills/workspace-init/scripts/setup-workspace.sh bugfix login-error PROJ-123
```

The script will:
- Create a working directory with proper naming convention
- Initialize git repository with `.gitignore`
- Create `tmp/` directory (gitignored, for temporary files)
- Create `artifacts/` directory (git-tracked, for persistent outputs)
- Generate README.md from template
- Create initial commit

**Capture the workspace name from the last line of output** for use in subsequent steps.

#### Step 2b: Add Repositories

For each repository, execute the repository setup script:

```bash
./.claude/scripts/setup-repository.sh <workspace-name> <org/repo-path>
```

**Examples:**

```bash
# Basic usage
./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo

# Override base branch (when user explicitly specifies)
BASE_BRANCH=develop ./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo

# With alias (for multiple worktrees from same repo)
./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo:dev
```

The script will:
- Clone the repository if not already cloned (to `repositories/` directory)
- Update the repository with `git fetch --all --prune`
- Auto-detect the base branch from remote default
- Create a git worktree in the workspace with a new feature branch

**After running the script**, update the README.md Repositories section:

```markdown
## Repositories

- **repo-name**: `github.com/org/repo` (base: `main`)
```

### 3. Fill in README.md

After setup completes, update the generated `README.md` with:

- Clear objective description
- Context and background
- Requirements and acceptance criteria
- Related resources (issues, docs, etc.)

**IMPORTANT: Write only confirmed facts, never assumptions or guesses.**

- Only include information that is explicitly provided by the user or retrieved from linked resources
- If essential information is missing (objective, requirements, context), use AskUserQuestion to ask the user
- Do NOT fill in placeholder text or make up details
- Leave sections empty with `<!-- TBD -->` if information is not available and user cannot provide it
- Read linked resources (Jira tickets, PRs, documentation) using appropriate tools to get accurate details

**DO NOT explore or analyze the repository codebase at this step.** Repository analysis is done by the TODO planner agents in the next step. This step focuses only on capturing task requirements from the user and linked resources.

This README is the source of truth that the TODO planner agents will read. Accuracy is critical.

### 4. Call workspace-repo-todo-planner for Each Repository

For each repository in the workspace, invoke the `workspace-repo-todo-planner` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-planner
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
```

**What the agent does (defined in agent, not by prompt):**
- Reads workspace README.md to understand the task
- Analyzes repository structure and documentation
- Creates detailed TODO items in `TODO-{repo-name}.md`

**Run multiple planners in parallel** if there are multiple repositories.

Each planner will:
- Read the workspace README.md to understand the task
- Analyze the repository structure and documentation
- Create detailed, actionable TODO items in `TODO-{repo-name}.md`

### 5. Call workspace-todo-coordinator

After all TODO planners complete, invoke the `workspace-todo-coordinator` agent:

```yaml
Task tool:
  subagent_type: workspace-todo-coordinator
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
```

**What the agent does (defined in agent, not by prompt):**
- Read all TODO files
- Analyze dependencies between repositories
- Restructure TODOs to maximize parallel execution
- Add coordination notes to README.md

### 6. Call workspace-repo-todo-reviewer for Each Repository

After coordination completes, invoke the `workspace-repo-todo-reviewer` agent for each repository:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-reviewer
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {repository-name}
```

**Run multiple reviewers in parallel** for all repositories.

**What the agent does (defined in agent, not by prompt):**
- Validates each TODO item for specificity, actionability, and alignment
- Marks unclear items with `[NEEDS_CLARIFICATION]` tags
- Returns a summary of issues (BLOCKING and UNCLEAR)

**After all reviewers complete:**

1. Collect results from all reviewers
2. If any BLOCKING issues exist:
   - Use AskUserQuestion to ask the user for clarification
   - Update the TODO files with the answers
   - Re-run reviewers if significant changes were made
3. If only UNCLEAR issues exist:
   - Present them to the user and ask whether to proceed or clarify
4. If no issues (STATUS: CLEAN for all repos):
   - Proceed to commit

### 7. Commit TODO Files

After review completes (and any clarifications are resolved), commit the TODO files:

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name} "Add TODO items for all repositories"
```

### 8. Display Workspace Files

After committing, display the relative paths of all workspace files for the user:

```
Workspace files created:
- workspace/{workspace-name}/README.md
- workspace/{workspace-name}/TODO-{repo1-name}.md
- workspace/{workspace-name}/TODO-{repo2-name}.md
...
```

List all TODO files that were created (one per repository).

## Example Usage

### Example 1: Single Repository

```
User: Initialize a workspace for user authentication feature in github.com/org/repo
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-user-auth-20260206
  2. [Runs setup-repository.sh] → Clones repo, creates worktree
  3. [Updates README.md Repositories section]
  4. [Fills in README.md with task details (Objective, Context, etc.)]
  5. [Calls workspace-repo-todo-planner] → Creates TODO-repo.md
  6. [Calls workspace-todo-coordinator] → Optimizes (single repo, minimal changes)
  7. [Calls workspace-repo-todo-reviewer] → Validates TODO items
  8. [If issues found, asks user for clarification]
  9. [Displays workspace files]:
     - workspace/feature-user-auth-20260206/README.md
     - workspace/feature-user-auth-20260206/TODO-repo.md
  10. Done!
```

### Example 2: Multiple Repositories

```
User: Initialize a workspace for adding product IDs to cart, involving:
      - github.com/org/proto (protobuf definitions)
      - github.com/org/api (API implementation)
      - github.com/org/frontend (UI)
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-product-ids-20260206
  2. [Runs setup-repository.sh 3 times] → Adds 3 repos sequentially
  3. [Updates README.md Repositories section with all 3 repos]
  4. [Fills in README.md with task details (Objective, Context, etc.)]
  5. [Calls 3 Task tools in single message for workspace-repo-todo-planner] → Creates TODO files in parallel
  6. [Calls workspace-todo-coordinator] → Optimizes for parallel execution
  7. [Calls 3 Task tools in single message for workspace-repo-todo-reviewer] → Validates all TODOs in parallel
  8. [If issues found, asks user for clarification]
  9. [Displays workspace files]:
     - workspace/feature-product-ids-20260206/README.md
     - workspace/feature-product-ids-20260206/TODO-proto.md
     - workspace/feature-product-ids-20260206/TODO-api.md
     - workspace/feature-product-ids-20260206/TODO-frontend.md
  10. Done!
```

### Example 3: Same Repository with Aliases (Dev/Prod)

```
User: Initialize a workspace for deploying a config change to both dev and prod,
      creating separate PRs for each in github.com/org/infra
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-config-change-20260206
  2. [Runs setup-repository.sh with github.com/org/infra:dev]
  3. [Runs setup-repository.sh with github.com/org/infra:prod]
  4. [Updates README.md with both entries]
  5. [Fills in README.md with task details]
  6. [Calls 2 Task tools in single message for workspace-repo-todo-planner]
  7. [Calls workspace-todo-coordinator]
  8. [Calls 2 Task tools in single message for workspace-repo-todo-reviewer]
  9. [If issues found, asks user for clarification]
  10. [Displays workspace files]:
      - workspace/feature-config-change-20260206/README.md
      - workspace/feature-config-change-20260206/TODO-infra___dev.md
      - workspace/feature-config-change-20260206/TODO-infra___prod.md
  11. Done! Each alias will result in a separate PR.
```

## Next Steps - Ask User to Proceed

After initialization is complete, **always ask the user** whether to proceed with the next step using AskUserQuestion:

```yaml
AskUserQuestion tool:
  questions:
    - question: "Workspace initialization complete. Would you like to proceed with executing the TODO items?"
      header: "Next Step"
      multiSelect: false
      options:
        - label: "Execute now"
          description: "Run /workspace-execute to work through TODO items immediately"
        - label: "Skip for now"
          description: "I'll review the workspace files first and execute later"
```

If the user selects "Execute now", invoke the `/workspace-execute` skill using the Skill tool.

## Notes

- Base branch is auto-detected from remote default unless explicitly specified
- `setup-workspace.sh` creates the workspace directory and README.md template
- `setup-repository.sh` handles cloning, updating, and worktree creation
- TODO files are created by planner agents, not by the setup scripts
- Workspace naming convention: `{task-type}-{ticket-id}-{description}-{date}` or `{task-type}-{description}-{date}`
- For single repository workspaces, the coordinator step is still run but makes minimal changes
- Alias syntax: Use `repo:alias` to create multiple worktrees from the same repository (e.g., `github.com/org/repo:dev`)
