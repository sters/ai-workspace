# .claude Directory

This directory contains Claude Code configuration for the multi-repository workspace manager.

## Directory Structure

```
.claude/
├── agents/          # Sub-agent definitions (invoked via Task tool)
├── skills/          # User-facing skills (/slash-commands)
├── scripts/         # Shared shell scripts
└── settings.local.json
```

## Implementation Policies for Agents

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

**Prompt Structure (`{agent-name}.md`):**
```markdown
---
name: {agent-name}
description: |
  Use this agent to {what it does}.
  Delegate to this agent when you need to:
  - {use case 1}
  - {use case 2}
tools:
  - Read
  - Write
  - ...
---

# {Agent Title}

{Role description - "You are a specialized agent for..."}

## Initial Context

When invoked, you will receive:
- **{Parameter}**: {description}

## Execution Steps

### 1. {Step Name}
{Instructions}

### 2. {Step Name}
{Instructions}

## Output

{What the agent produces and where}

## Guidelines

{Important rules and constraints}

## Communication

{Completion report format, reference to templates/{agent-name}/}
```

## Implementation Policies for Skills

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

**Prompt Structure (`SKILL.md`):**
```markdown
---
name: {skill-name}
description: {Short description}
---

# {skill-name}

## Overview

{What this skill does, when to use it}

**After completion:** {Suggested next skill}

## Steps

### 1. {Step Name}
{Instructions, script calls, or agent delegation}

### 2. {Step Name}
{Instructions}

## Example Usage (optional)

### Example 1: {Scenario}
{User/Assistant interaction example}

## Next Steps - Ask User to Proceed (optional)

{AskUserQuestion tool example for suggesting next actions}
{Can be omitted for simple skills like list/show commands}

## Notes

{Additional information, constraints}
```

## Shared Scripts

Scripts used across multiple skills/agents are placed in `.claude/scripts/`:
```
.claude/scripts/
├── list-workspaces.sh                 # List all workspaces
├── list-workspace-repos.sh            # List repositories in a workspace
├── list-workspace-todos.sh            # List TODO files in a workspace
└── commit-workspace-snapshot.sh       # Commit workspace changes
```
