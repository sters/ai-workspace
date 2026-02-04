---
name: workspace-init
description: Initialize a working directory for development tasks
---

# workspace-init

## Overview

This skill initializes a working environment for development tasks. It orchestrates:
1. Workspace directory setup (via `setup-workspace.sh`)
2. Repository addition with worktrees (via `setup-repository.sh`)
3. README creation with task details
4. TODO planning for each repository (via workspace-repo-todo-planner agent)
5. Cross-repository coordination (via workspace-todo-coordinator agent)

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
- Target repository path(s) in org/repo format (e.g., github.com/sters/complex-ai-workspace)
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
- Create `tmp/` directory
- Generate README.md from template
- Create initial commit

#### Step 2b: Fill in README.md Repositories Section

Before adding repositories, update the `## Repositories` section in README.md with the list of repositories:

```markdown
## Repositories

- **repo1**: `github.com/org/repo1` (base: `main`)
- **repo2**: `github.com/org/repo2` (base: `main`)
```

**Important:** This must be done before running `setup-repository.sh` to allow parallel execution.

#### Step 2c: Add Repositories (run in parallel)

For each repository, execute the repository setup script using the Bash tool.

**IMPORTANT:** When there are multiple repositories, call multiple Bash tools in a single message to run them in parallel.

```bash
./.claude/skills/workspace-init/scripts/setup-repository.sh <workspace-name> <org/repo-path>
```

**Single repository:**

```yaml
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo
```

**Multiple repositories (parallel execution):**

Call multiple Bash tools in a single message:

```yaml
# First Bash tool call
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo1

# Second Bash tool call (in same message)
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo2

# Third Bash tool call (in same message)
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo3
```

**Override base branch** (when user explicitly specifies):

```yaml
Bash tool:
  command: BASE_BRANCH=develop ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo
```

**Same repository with different aliases** (for separate PRs):

```yaml
# First Bash tool call - dev environment
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo:dev

# Second Bash tool call (in same message) - prod environment
Bash tool:
  command: ./.claude/skills/workspace-init/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo:prod
```

This creates:
- `github.com/org/repo___dev/` with branch `feature/user-auth-dev`
- `github.com/org/repo___prod/` with branch `feature/user-auth-prod`
- `TODO-repo___dev.md` and `TODO-repo___prod.md`

The script will:
- Clone or update the target repository
- Detect the base branch (auto or from BASE_BRANCH env)
- Create a git worktree in the working directory

### 3. Fill in README.md

After setup completes, update the generated `README.md` with:

- Clear objective description
- Context and background
- Requirements and acceptance criteria
- Related resources (issues, docs, etc.)

This README is the source of truth that the TODO planner agents will read.

### 4. Call workspace-repo-todo-planner for Each Repository

For each repository in the workspace, invoke the `workspace-repo-todo-planner` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-planner
  run_in_background: true
  prompt: |
    Create TODO items for repository in workspace.
    Workspace Name: {workspace-name}
    Repository Path: {org/repo-path}
    Repository Name: {repo-name}
```

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
    Coordinate TODO items across repositories in workspace.
    Workspace Name: {workspace-name}
```

The coordinator will:
- Read all TODO files
- Analyze dependencies between repositories
- Restructure TODOs to maximize parallel execution
- Add coordination notes to README.md

### 6. Commit TODO Files

After coordination completes, commit the TODO files:

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name} "Add TODO items for all repositories"
```

## Example Usage

### Example 1: Single Repository

```
User: Initialize a workspace for user authentication feature in github.com/org/repo
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-user-auth-20260116
  2. [Fills in README.md Repositories section]
  3. [Runs setup-repository.sh] → Adds repo with worktree
  4. [Fills in README.md with task details (Objective, Context, etc.)]
  5. [Calls workspace-repo-todo-planner] → Creates TODO-repo.md
  6. [Calls workspace-todo-coordinator] → Optimizes (single repo, minimal changes)
  7. Done!
```

### Example 2: Multiple Repositories

```
User: Initialize a workspace for adding product IDs to cart, involving:
      - github.com/org/proto (protobuf definitions)
      - github.com/org/api (API implementation)
      - github.com/org/frontend (UI)
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-product-ids-20260116
  2. [Fills in README.md Repositories section with all 3 repos]
  3. [Calls 3 Bash tools in single message for setup-repository.sh] → Adds 3 repos with worktrees in parallel
  4. [Fills in README.md with task details (Objective, Context, etc.)]
  5. [Calls 3 Task tools in single message for workspace-repo-todo-planner] → Creates TODO files in parallel
     - proto planner → TODO-proto.md
     - api planner → TODO-api.md
     - frontend planner → TODO-frontend.md
  6. [Calls workspace-todo-coordinator]
     - Identifies: proto → api → frontend dependency chain
     - Restructures TODOs to allow parallel work with stubs
  7. Done!
```

### Example 3: Same Repository with Aliases (Dev/Prod)

```
User: Initialize a workspace for deploying a config change to both dev and prod,
      creating separate PRs for each in github.com/org/infra
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-config-change-20260201
  2. [Fills in README.md Repositories section]:
     - **infra-dev**: `github.com/org/infra:dev`
     - **infra-prod**: `github.com/org/infra:prod`
  3. [Calls 2 Bash tools in single message for setup-repository.sh]:
     - github.com/org/infra:dev → worktree at github.com/org/infra___dev/, branch feature/config-change-dev
     - github.com/org/infra:prod → worktree at github.com/org/infra___prod/, branch feature/config-change-prod
  4. [Fills in README.md with task details]
  5. [Calls 2 Task tools in single message for workspace-repo-todo-planner]:
     - Creates TODO-infra___dev.md
     - Creates TODO-infra___prod.md
  6. [Calls workspace-todo-coordinator]
  7. Done! Each alias will result in a separate PR.
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

- Base branch is auto-detected from remote default unless explicitly specified via BASE_BRANCH env
- `setup-workspace.sh` creates the workspace directory and README.md template
- `setup-repository.sh` clones/updates repos and creates worktrees; call multiple Bash tools in single message for parallel execution
- **Fill in README.md Repositories section before running `setup-repository.sh`** to enable parallel execution
- TODO files are created by planner agents, not by the setup scripts
- Workspace naming convention: `{task-type}-{ticket-id}-{description}-{date}` or `{task-type}-{description}-{date}`
- For single repository workspaces, the coordinator step is still run but makes minimal changes
- **Alias syntax**: Use `repo:alias` to create multiple worktrees from the same repository (e.g., `github.com/org/repo:dev` and `github.com/org/repo:prod`). The alias is converted to `___alias` in directory names for filesystem safety.
