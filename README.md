# complex-ai-workspace

A multi-repository workspace manager for Claude Code. This tool provides Claude with skills and sub-agents to handle complex tasks across multiple repositories using git worktrees for isolation.

## Prerequisites

The following tools must be installed and available in your PATH:

- **git** - For repository cloning, worktree management, and version control operations
- **gh** (GitHub CLI) - For creating and managing pull requests

### Installation

```bash
# macOS (Homebrew)
brew install git gh

# Authenticate with GitHub
gh auth login
```

## Usage

1. Clone this repo
2. Open with `claude` command (Claude Code CLI)
3. Initialize a workspace:
   ```
   /workspace-init Add user authentication feature to github.com/org/repo
   ```

   More examples:
   ```
   # With Jira ticket
   /workspace-init PROJ-123 Fix login timeout issue in github.com/org/api

   # Multiple repositories
   /workspace-init Add product ID to cart API involving github.com/org/proto and github.com/org/api

   # Research task
   /workspace-init Investigate performance bottleneck in github.com/org/backend
   ```
4. Execute the tasks:
   ```
   /workspace-execute
   ```
5. Review and create PR:
   ```
   /workspace-review-changes
   /workspace-create-pr
   ```

## How It Works

Tasks are executed in isolated directories (`./workspace/{task-name}-{date}/`) using git worktrees. Claude clones the target repository on first use to `./repositories/` and creates worktrees for each task.

## Available Skills

| Skill | Description |
|-------|-------------|
| `/workspace-init` | Initialize workspace with worktree, README, and TODO files |
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

See [CLAUDE.md](./CLAUDE.md) for detailed documentation.

## Available Agents

Agents are specialized sub-processes that handle specific tasks autonomously. **You don't need to invoke agents directly** — skills automatically launch the appropriate agents for you.

| Agent | Description | Invoked by |
|-------|-------------|------------|
| `workspace-repo-todo-planner` | Analyzes repository and creates detailed TODO items | `/workspace-init` |
| `workspace-todo-coordinator` | Coordinates TODOs across repos for parallel execution | `/workspace-init` |
| `workspace-repo-todo-executor` | Executes TODO items (implements code, runs tests, commits) | `/workspace-execute` |
| `workspace-repo-todo-updater` | Updates TODO items (add, remove, modify) | `/workspace-update-todo` |
| `workspace-repo-review-changes` | Reviews code changes and generates review report | `/workspace-review-changes` |
| `workspace-collect-reviews` | Collects review results and creates summary | `/workspace-review-changes` |
| `workspace-repo-create-pr` | Creates pull request following repo's PR template | `/workspace-create-pr` |

### Skills and Agents Relationship

```
/workspace-init
  ├─→ workspace-repo-todo-planner (per repository, parallel)
  └─→ workspace-todo-coordinator

/workspace-execute
  └─→ workspace-repo-todo-executor (per repository)

/workspace-update-todo
  └─→ workspace-repo-todo-updater

/workspace-review-changes
  ├─→ workspace-repo-review-changes (per repository, parallel)
  └─→ workspace-collect-reviews

/workspace-create-pr
  └─→ workspace-repo-create-pr (per repository, parallel)
```

## Policies

See [.claude/README.md](./.claude/README.md) for implementation policies for agents and skills.
