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
| `/workspace-execute` | Continue/resume work — executes TODO items (feature/bugfix) or runs cross-repo research (research/investigation) |
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
3. **Task type branching**: Research/investigation tasks skip TODO planning (steps 4-5 below)
4. Calls `workspace-repo-todo-planner` for each repository (parallel) → Creates `TODO-{repo}.md`
5. Calls `workspace-todo-coordinator` → Optimizes TODOs for parallel execution
6. Calls `workspace-repo-todo-reviewer` for each repository (parallel) → Validates TODOs, asks user for clarification if needed

### 2. Execute Tasks

```
/workspace-execute
```

Detects task type and routes accordingly:

**Research/Investigation tasks** → Delegates to `workspace-researcher` agent which:
- Reads README.md to understand research objectives
- Investigates all repositories in the workspace (cross-repo)
- Writes findings to `artifacts/research-report.md`

**Feature/Bugfix tasks** → Delegates to `workspace-repo-todo-executor` agent (per repo) which:
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

Generates reports in `workspace/{task}/artifacts/reviews/{timestamp}/`:
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

## Post-Skill Routing

Forked skills (`context: fork`) return structured `SKILL_COMPLETE` messages instead of chaining to the next skill. When you receive a `SKILL_COMPLETE` response, parse the `NEXT_ACTION` field and present the suggested next step to the user.

| Completed Skill | Suggested Next Action |
|----------------|---------------------|
| `workspace-init` | `workspace-execute` |
| `workspace-execute` (Route B) | `workspace-review-changes` |
| `workspace-review-changes` | `workspace-create-or-update-pr` |
| `workspace-create-or-update-pr` | (terminal — no next action) |
| `workspace-update-todo` | `workspace-execute` |

**Routing flow:**
1. Receive `SKILL_COMPLETE` from forked skill
2. Display the `SUMMARY` to the user
3. If `NEXT_ACTION` is not `none`, ask the user whether to proceed:
   - "Yes" → invoke the suggested skill with the workspace name
   - "No" → end the workflow
4. If `NEXT_ACTION` is `none`, just display the summary

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
        │   ├── reviews/        # Code review output
        │   └── research-report.md  # Research findings (research tasks only)
        ├── tmp/                # Temporary files (PR bodies, scratch) - gitignored
        └── {org}/{repo}/       # Git worktree (excluded from workspace git)
```

Each workspace is a git repository that tracks README.md, TODO-*.md, and artifacts/ (including reviews/) changes. Use `/workspace-show-history` to view the history.

## Key Constraints

- **Never use `cd` in Bash commands** — always execute from the project root (ai-workspace root). Use `git -C <path>` or tool-specific path arguments instead. See [.claude/README.md](./.claude/README.md) for details.
- **Never use `TaskOutput` tool** — background agents send results via `<task-notification>` automatically. `TaskOutput` returns full transcripts (100-400KB) that destroy context.
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
