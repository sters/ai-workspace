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
/workspace-create-or-update-pr
```

## Task Detection & Routing

When a user shares a task — even without explicitly calling a slash command — automatically route to the workspace system.

### Trigger Patterns

Recognize these as workspace tasks:
- **Ticket URLs**: Jira (`atlassian.net/browse/XXX`), GitHub Issues (`github.com/.../issues/N`), Linear, etc. paired with a request to work on it
- **Task requests**: "work on X", "implement X", "fix X", "build X", "start X"
- **Casual requests**: "これをすすめて", "これやって", "取り掛かって", "this ticket please", etc.
- **Feature/bugfix descriptions** that imply multi-step development work across repositories

### Routing Logic

1. **First**: Run `/workspace-list` to check for existing workspaces matching the ticket/task
2. **If workspace exists**:
   - Run `/workspace-show-status {workspace}` to check progress
   - If TODO items remain → suggest or run `/workspace-execute`
   - If all items done → suggest `/workspace-review-changes` or `/workspace-create-or-update-pr`
3. **If no workspace exists**: Run `/workspace-init` to create a new workspace
4. **If ticket URL is provided**: Fetch the ticket details (using appropriate tools) and use them to fill in the workspace README

### Examples

```
# User pastes a Jira ticket URL and says "work on this"
User: https://mercari.atlassian.net/browse/CC-2573 これをすすめて
→ 1. /workspace-list → check if CC-2573 workspace exists
→ 2a. If exists: /workspace-show-status → /workspace-execute (resume)
→ 2b. If not: /workspace-init (create new workspace for CC-2573)

# User describes a task
User: Add retry logic to the payment service in github.com/org/payment-api
→ 1. /workspace-list → no matching workspace
→ 2. /workspace-init feature add-retry-logic github.com/org/payment-api

# User wants to continue previous work
User: CC-2573の続きをやって
→ 1. /workspace-list → find workspace with CC-2573
→ 2. /workspace-show-status → check progress
→ 3. /workspace-execute → resume work
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `/workspace-init` | Start working on a new task/ticket/feature — creates workspace, clones repos, plans TODOs (always check `/workspace-list` first) |
| `/workspace-add-repo` | Add a repository to an existing workspace (clones if needed, creates worktree) |
| `/workspace-execute` | Continue/resume work — executes TODO items in an existing workspace (implements code, runs tests, commits) |
| `/workspace-review-changes` | Review code changes and generate review reports |
| `/workspace-create-or-update-pr` | Create or update pull requests for all repositories (draft by default) |
| `/workspace-update-todo` | Add, remove, or modify TODO items |
| `/workspace-show-status` | Check progress of a workspace — shows TODO completion and agent status |
| `/workspace-list` | List all workspaces — use to find existing workspaces before creating new ones |
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
/workspace-create-or-update-pr
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
        ├── artifacts/          # Persistent outputs (research, notes, etc.) - git tracked
        ├── tmp/                # Temporary files (PR bodies, scratch) - gitignored
        ├── reviews/            # Code review output
        └── {org}/{repo}/       # Git worktree (excluded from workspace git)
```

Each workspace is a git repository that tracks README.md, TODO-*.md, artifacts/, and reviews/ changes. Use `/workspace-show-history` to view the history.

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
