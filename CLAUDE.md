# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a multi-repository workspace manager for Claude Code. It enables complex tasks across multiple repositories using git worktrees for isolation. The system uses skills and sub-agents to orchestrate work.

## Quick Start

```bash
# 1. Initialize workspace (creates worktree, README, plans TODO items via agents)
/workspace-init feature user-auth github.com/org/repo

# 2. Execute TODO items (delegates to workspace-repo-todo-executor agent)
/workspace-execute

# 3. Review changes before PR (optional but recommended)
/workspace-review-changes

# 4. Create pull request
/workspace-create-pr
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `/workspace-init` | Initialize workspace with worktree, README, and TODO files |
| `/workspace-add-repo` | Add a repository to an existing workspace |
| `/workspace-execute` | Execute TODO items via workspace-repo-todo-executor agent |
| `/workspace-review-changes` | Review code changes via workspace-repo-review-changes agent |
| `/workspace-create-pr` | Create PRs for all repositories (draft by default) |
| `/workspace-update-todo` | Update TODO items in a workspace repository |
| `/workspace-show-current` | Show the currently focused workspace |
| `/workspace-list` | List all workspaces in the workspace directory |
| `/workspace-show-status` | Show TODO progress and background agent status |
| `/workspace-delete` | Delete a workspace after confirmation |
| `/workspace-prune` | Delete stale workspaces not modified recently |
| `/workspace-show-history` | Show git history of a workspace (README/TODO changes) |

## Primary Workflow

### 1. Initialize Workspace

```
/workspace-init {task-description}
```

Orchestrates workspace setup:
1. Runs setup script: Creates directory, worktrees, `README.md` template
2. Fills in `README.md` with task details
3. Calls `workspace-repo-todo-planner` for each repository (parallel) → Creates `TODO-{repo}.md`
4. Calls `workspace-todo-coordinator` → Optimizes TODOs for parallel execution

### 2. Execute Tasks

```
/workspace-execute
```

Delegates to `workspace-repo-todo-executor` agent which:
- Reads README.md and TODO file to understand the task
- Works through TODO items sequentially
- Follows TDD (or repository-specified methodology)
- Runs tests and linters
- Makes commits with descriptive messages

### 3. Review Changes (Recommended)

```
/workspace-review-changes
```

Launches `workspace-repo-review-changes` agent for each repository:
- Compares current branch against remote base branch
- Reviews for security, performance, and code quality issues
- Generates review reports in `workspace/{task}/reviews/{timestamp}/`

### 4. Create Pull Request

```
/workspace-create-pr
```

- Finds and follows the repository's PR template
- Creates a well-formatted pull request with gh CLI
- **Creates as draft by default** (unless explicitly requested otherwise)

## Directory Structure

```
.
├── .claude/
│   ├── agents/                 # Sub-agent definitions (workspace-repo-todo-executor, workspace-repo-review-changes, etc.)
│   ├── skills/                 # User-invokable skills
│   └── settings.local.json     # Allowed bash commands
├── repositories/               # Cloned repos (git data source)
└── workspace/                  # Active task directories (worktrees)
    └── {task-name}-{date}/
        ├── .git/               # Workspace git repo (tracks README/TODO history)
        ├── .gitignore          # Excludes worktrees (github.com/, etc.)
        ├── README.md           # Task context
        ├── TODO-{repo}.md      # Task checklist
        ├── reviews/            # Code review output
        └── {org}/{repo}/       # Git worktree (excluded from workspace git)
```

Each workspace is a git repository that tracks README.md, TODO-*.md, and reviews/ changes. Use `/workspace-show-history` to view the history.

## Key Constraints

- Never push to remote unless explicitly requested
- Never merge branches
- Work only within the workspace directory scope

## Implementation Policies

See [.claude/README.md](./.claude/README.md) for implementation policies for agents and skills.

## Language Policy

**Communication with users**: Match the user's language. If the user writes in Japanese, respond in Japanese. If in English, respond in English.

**External outputs (MUST be in English unless explicitly requested otherwise)**:
- Git commit messages
- Pull request titles and descriptions
- Code comments
- File contents (README.md, TODO files, review reports, etc.)
- Branch names
- Any content that will be stored in repositories or shared externally
