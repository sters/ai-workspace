---
name: init-workspace
description: Initialize a working directory for development tasks
---

# init-workspace

## Overview

This skill initializes a working environment for development tasks. It orchestrates:
1. Directory and worktree setup (via shell script)
2. README creation with task details
3. TODO planning for each repository (via workspace-repo-todo-planner agent)
4. Cross-repository coordination (via workspace-todo-coordinator agent)

**After initialization:** Use `/execute-workspace` to work through TODO items and complete the task.

## Execution Flow

```
init-workspace (this skill - orchestrator)
    │
    ├─ 1. Run setup-workspace.sh
    │      └── Creates directory, worktree, README.md template
    │
    ├─ 2. Fill in README.md with task details
    │
    ├─ 3. For each repository, call workspace-repo-todo-planner (parallel)
    │      ├── repo-A → TODO-repo-A.md
    │      ├── repo-B → TODO-repo-B.md
    │      └── repo-C → TODO-repo-C.md
    │
    ├─ 4. Call workspace-todo-coordinator
    │      └── Optimize TODOs for parallel execution, resolve dependencies
    │
    └─ 5. Done - ask user about next steps
```

## Steps

### 1. Understand the Task Requirements

Before running the setup script, ensure you have:

- Task type (feature, bugfix, research, etc.)
- Brief description
- Target repository path(s) in org/repo format (e.g., github.com/sters/complex-ai-workspace)
- Ticket ID (optional)

**Note:** Base branch is automatically detected from the remote default (main/master). You don't need to specify it.

### 2. Run Setup Script (for each repository)

Execute the setup script with the required parameters:

```bash
./.claude/skills/init-workspace/scripts/setup-workspace.sh <task-type> <description> <org/repo-name> [ticket-id]
```

**Examples:**

```bash
# Basic usage - base branch is auto-detected
./.claude/skills/init-workspace/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace

# With ticket ID
./.claude/skills/init-workspace/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace PROJ-123

# Bug fix
./.claude/skills/init-workspace/scripts/setup-workspace.sh bugfix login-error github.com/sters/complex-ai-workspace

# Override base branch - use when the user explicitly specifies a branch
BASE_BRANCH=develop ./.claude/skills/init-workspace/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace
```

The script will automatically:

- Create a working directory with proper naming convention
- Clone or update the target repository
- Create a git worktree in the working directory
- Generate README.md with task template

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
    Workspace Directory: workspace/{workspace-name}
    Repository Path: {org/repo-path}
    Repository Name: {repo-name}
    Repository Worktree Path: workspace/{workspace-name}/{org}/{repo}
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
    Workspace Directory: workspace/{workspace-name}
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
  2. [Fills in README.md with task details]
  3. [Calls workspace-repo-todo-planner] → Creates TODO-repo.md
  4. [Calls workspace-todo-coordinator] → Optimizes (single repo, minimal changes)
  5. Done!
```

### Example 2: Multiple Repositories

```
User: Initialize a workspace for adding product IDs to cart, involving:
      - github.com/org/proto (protobuf definitions)
      - github.com/org/api (API implementation)
      - github.com/org/frontend (UI)
Assistant:
  1. [Runs setup-workspace.sh x3] → Creates workspace with 3 worktrees
  2. [Fills in README.md with task details]
  3. [Calls workspace-repo-todo-planner x3 in parallel]
     - proto planner → TODO-proto.md
     - api planner → TODO-api.md
     - frontend planner → TODO-frontend.md
  4. [Calls workspace-todo-coordinator]
     - Identifies: proto → api → frontend dependency chain
     - Restructures TODOs to allow parallel work with stubs
  5. Done!
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
          description: "Run /execute-workspace to work through TODO items immediately"
        - label: "Skip for now"
          description: "I'll review the workspace files first and execute later"
```

If the user selects "Execute now", invoke the `/execute-workspace` skill using the Skill tool.

## Notes

- Base branch is auto-detected from remote default unless explicitly specified
- The setup script creates README.md from template; TODO files are created by planner agents
- Workspace naming convention: `{task-type}-{ticket-id}-{description}-{date}` or `{task-type}-{description}-{date}`
- For single repository workspaces, the coordinator step is still run but makes minimal changes