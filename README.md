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

### Agents

Agents are autonomous workers that perform specific tasks. They are invoked via the `Task` tool with `run_in_background: true`.

**Naming Convention:**
- `workspace-repo-{action}` - Operates on a single repository within a workspace
- `workspace-{action}` - Operates on the entire workspace (e.g., `workspace-todo-coordinator`)

**Directory Structure:**
```
.claude/agents/
├── {agent-name}.md                    # Agent definition
├── scripts/{agent-name}/              # Scripts used by this agent
│   └── {script}.sh
└── templates/{agent-name}/            # Templates used by this agent
    ├── {template}.md                  # Output templates
    └── {completion-report}.md         # Completion report format
```

**Design Principles:**
- **Single responsibility**: One agent, one job
- **Scope awareness**: Repository-scoped agents don't touch other repos
- **Template-driven output**: Use templates for consistent formatting
- **Completion reports**: Always report results in a structured format
- **No nesting**: Agents cannot invoke other agents (use skills for orchestration)

### Skills

Skills are user-facing commands (`/skill-name`) that orchestrate agents and scripts.

**Naming Convention:**
- `workspace-{action}` - Actions on workspaces (e.g., `workspace-init`, `workspace-execute`)
- `workspace-show-{target}` - Display information (e.g., `workspace-list`, `workspace-show-status`)
- `workspace-{action}-{target}` - Specific actions (e.g., `workspace-update-todo`)

**Directory Structure:**
```
.claude/skills/{skill-name}/
├── SKILL.md                           # Skill definition and instructions
├── scripts/                           # Scripts used by this skill
│   └── {script}.sh
└── templates/                         # Templates used by this skill
    └── {template}.md
```

**Design Principles:**
- **User interface**: Skills are the primary way users interact with the system
- **Orchestration**: Complex skills coordinate multiple agents
- **Script preference**: Simple tasks use scripts directly, complex tasks delegate to agents
- **Confirmation prompts**: Destructive actions require user confirmation
- **Next step guidance**: After completion, suggest logical next steps

**Shared Scripts:**
Scripts used across multiple skills/agents are placed in `.claude/scripts/`:
```
.claude/scripts/
└── commit-workspace-snapshot.sh       # Used by multiple skills
```
