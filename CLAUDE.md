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
| `/workspace-init` | Create a new workspace with README and TODO files (calls `/workspace-add-repo` to clone and create worktrees) |
| `/workspace-add-repo` | Add a repository to a workspace (clones if needed, creates worktree) |
| `/workspace-execute` | Execute TODO items (implements code, runs tests, makes commits) |
| `/workspace-review-changes` | Review code changes and generate review reports |
| `/workspace-create-pr` | Create pull requests for all repositories (draft by default) |
| `/workspace-update-todo` | Add, remove, or modify TODO items |
| `/workspace-show-status` | Show TODO progress and background agent status |
| `/workspace-list` | List all workspaces |
| `/workspace-show-current` | Display the specified workspace path |
| `/workspace-show-history` | Show commit history of README/TODO changes |
| `/workspace-delete` | Delete a workspace (with confirmation) |
| `/workspace-prune` | Delete workspaces not modified within N days |

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
5. Calls `workspace-repo-todo-reviewer` for each repository (parallel) → Validates TODOs, asks user for clarification if needed

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

Launches agents for each repository (in parallel):
- `workspace-repo-review-changes`: Reviews code for security, performance, and quality issues
- `workspace-repo-todo-verifier`: Verifies TODO items have been completed

Generates reports in `workspace/{task}/reviews/{timestamp}/`:
- `REVIEW-{org}_{repo}.md` - Code review report
- `TODO-VERIFY-{org}_{repo}.md` - TODO completion verification
- `SUMMARY.md` - Aggregated summary

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
