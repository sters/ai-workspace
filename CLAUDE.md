# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a multi-repository workspace manager for Claude Code. It enables complex tasks across multiple repositories using git worktrees for isolation. The system uses skills and sub-agents to orchestrate work.

## Quick Start

```bash
# 1. Initialize workspace (creates worktree, README, TODO files)
/init-workspace feature user-auth github.com/org/repo

# 2. Execute TODO items (delegates to workspace-repo-todo-executor agent)
/execute-workspace

# 3. Review changes before PR (optional but recommended)
/review-workspace-changes

# 4. Create pull request
/create-pr-workspace
```

## Primary Workflow

### 1. Initialize Workspace

```
/init-workspace {task-description}
```

Runs the setup script which:
- Creates `workspace/{task-type}-{description}-{date}/` directory
- Clones or updates target repositories
- Creates git worktrees for isolated work (branch auto-created from base)
- Generates `README.md` and `TODO-{repo-name}.md` templates

### 2. Execute Tasks

```
/execute-workspace
```

Delegates to `workspace-repo-todo-executor` agent which:
- Reads README.md and TODO file to understand the task
- Works through TODO items sequentially
- Follows TDD (or repository-specified methodology)
- Runs tests and linters
- Makes commits with descriptive messages

### 3. Review Changes (Recommended)

```
/review-workspace-changes
```

Launches `review-workspace-repo-changes` agent for each repository:
- Compares current branch against remote base branch
- Reviews for security, performance, and code quality issues
- Generates review reports in `workspace/{task}/reviews/{timestamp}/`

### 4. Create Pull Request

```
/create-pr-workspace
```

- Finds and follows the repository's PR template
- Creates a well-formatted pull request with gh CLI
- **Creates as draft by default** (unless explicitly requested otherwise)

### Additional Skills

- `/update-workspace-todo` - Update TODO items in a workspace repository
- `/delete-workspace` - Delete a workspace after confirmation

## Directory Structure

```
.
├── .claude/
│   ├── agents/                 # Sub-agent definitions
│   │   ├── workspace-repo-todo-executor.md
│   │   └── review-workspace-repo-changes.md
│   ├── skills/                 # User-invokable skills
│   │   ├── init-workspace/     # Workspace initialization
│   │   ├── execute-workspace/  # Task execution
│   │   ├── create-pr/          # PR creation with template
│   │   └── review-workspace-changes/
│   └── settings.local.json     # Allowed bash commands
├── repositories/               # Cloned repos (git data source)
└── workspace/                  # Active task directories (worktrees)
    └── {task-name}-{date}/
        ├── README.md           # Task context
        ├── TODO-{repo}.md      # Task checklist
        ├── reviews/            # Code review output
        └── {org}/{repo}/       # Git worktree
```

## Setup Script

```bash
./.claude/skills/init-workspace/scripts/setup-workspace.sh <task-type> <description> <org/repo> [ticket-id]

# Examples:
./.claude/skills/init-workspace/scripts/setup-workspace.sh feature user-auth github.com/org/repo
./.claude/skills/init-workspace/scripts/setup-workspace.sh bugfix login-error github.com/org/repo PROJ-123

# Override auto-detected base branch:
BASE_BRANCH=develop ./.claude/skills/init-workspace/scripts/setup-workspace.sh feature user-auth github.com/org/repo
```

**Task types** (determines TODO template):
- `feature` / `implementation` - Uses feature TODO template
- `bugfix` / `bug` - Uses bugfix TODO template
- `research` - Uses research TODO template
- Other - Uses default TODO template

## Sub-Agent Invocation

When delegating to sub-agents, use the Task tool. **IMPORTANT: Always run agents in background** using `run_in_background: true`.

```yaml
# Execute TODO items
Task tool:
  subagent_type: workspace-repo-todo-executor
  run_in_background: true
  prompt: |
    Execute tasks in workspace: workspace/{workspace-name}
    Repository path: {org/repo-path}
    Repository name: {repo-name}
    Repository worktree path: workspace/{workspace-name}/{org}/{repo}

# Review changes
Task tool:
  subagent_type: review-workspace-repo-changes
  run_in_background: true
  prompt: |
    Review changes for repository in workspace.
    Task Name: {task-name}
    Workspace Directory: workspace/{workspace-name}
    Repository Path: {org/repo-path}
    Repository Name: {repo-name}
    Repository Worktree Path: workspace/{workspace-name}/{org}/{repo}
    Base Branch: {base-branch}
    Save review to: workspace/{workspace-name}/reviews/{timestamp}/{org}_{repo}.md
```

## Managed Repository Types

| Stack | Build | Test | Lint |
|-------|-------|------|------|
| Next.js/React | `npm run build` | `npm test` | `npm run lint` |
| pnpm monorepo | `pnpm build` | `pnpm test` | `pnpm lint` |
| Go | `make build` | `make test` | `make lint` |
| Protobuf | `make proto/go` | `make test` | `make lint` |

**Priority order for commands**: Repository CLAUDE.md → README.md → Makefile targets → language defaults

## Key Constraints

- Never push to remote unless explicitly requested
- Never merge branches
- Work only within the workspace directory scope
- Re-read TODO files before updating (detect concurrent modifications)
- Run tests and linters before completing work
- Follow repository-specified methodology (TDD if not specified)
- **Always run sub-agents in background** (`run_in_background: true`)

## Language Policy

**Communication with users**: Match the user's language. If the user writes in Japanese, respond in Japanese. If in English, respond in English.

**External outputs (MUST be in English unless explicitly requested otherwise)**:
- Git commit messages
- Pull request titles and descriptions
- Code comments
- File contents (README.md, TODO files, review reports, etc.)
- Branch names
- Any content that will be stored in repositories or shared externally

**Internal processing**: All skill definitions, agent prompts, and system configurations are written in English.

## Review Output

Reviews are saved to `workspace/{task}/reviews/{timestamp}/`:
- Individual reviews: `{org}_{repo}.md` (slashes replaced with underscores)
- Summary: `SUMMARY.md`
