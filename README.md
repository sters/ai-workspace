# complex-ai-workspace

A multi-repository workspace manager for Claude Code. This tool provides Claude with skills and sub-agents to handle complex tasks across multiple repositories using git worktrees for isolation.

## Usage

1. Clone this repo
2. Open with `claude` command (Claude Code CLI)
3. Initialize a workspace:
   ```
   /workspace-init feature user-auth github.com/org/repo
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

## Policies

See [.claude/README.md](./.claude/README.md) for implementation policies for agents and skills.
