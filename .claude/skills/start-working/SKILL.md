---
name: start-working
description: A skill to set up and manage a working directory for development tasks
---

# start-working

## Overview

This skill helps you set up a working environment and manage tasks systematically using an automated setup script.

## Steps

### 1. Understand the Task Requirements

Before running the setup script, ensure you have:

- Task type (feature, bugfix, research, etc.)
- Brief description
- Target repository name
- Base branch (optional - will be auto-detected if not specified)
- Ticket ID (optional)

### 2. Run Setup Script

Execute the setup script with the required parameters:

```bash
./.claude/skills/start-working/scripts/setup-workspace.sh <task-type> <description> <repository-name> [base-branch] [ticket-id]
```

**Examples:**

```bash
# Auto-detect base branch
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth complex-ai-workspace

# Specify base branch
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth complex-ai-workspace main

# With ticket ID
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth complex-ai-workspace main PROJ-123

# Bug fix with auto-detected branch
./.claude/skills/start-working/scripts/setup-workspace.sh bugfix login-error complex-ai-workspace

# Research task with specific branch
./.claude/skills/start-working/scripts/setup-workspace.sh research performance-analysis complex-ai-workspace develop
```

The script will automatically:

- Create a working directory with proper naming convention
- Clone or update the target repository
- Create a git worktree in the working directory
- Generate README.md with task template
- Generate `TODO-<repository-name>.md` with task-specific checklist

### 3. Customize Documentation

After setup completes:

- Open the generated `README.md` and fill in task details
- Review and customize `TODO-<repository-name>.md` checklist as needed

### 4. Execute Work According to TODO

- Work through `TODO-<repository-name>.md` checklist items sequentially
- Check off items as you complete them
- Update the TODO file if you discover additional tasks
- Add notes or blockers under each item if needed
- If you encounter issues, document them in the TODO file
- Regularly save and commit your progress
- Do not proceed to next items if current item has blockers

### 5. Delegate to workspace-executor SubAgent

Use the `workspace-executor` sub-agent to autonomously execute TODO items, run tests/linters, and commit changes.

**How to invoke:**

Use the Task tool to launch the workspace-executor agent:

```yaml
Task tool:
  subagent_type: workspace-executor
  prompt: |
    Execute tasks in workspace: workspace/feature-user-auth-20260116
    Repository name: complex-ai-workspace
    Repository path: workspace/feature-user-auth-20260116/complex-ai-workspace
```

**What the agent does:**

- Reads README.md and `TODO-<repository-name>.md` to understand the task
- Executes TODO items sequentially
- Updates the TODO file as items are completed
- Runs tests and linters
- Makes commits with descriptive messages
- Reports completion summary

**When to use SubAgent delegation:**

- Task has 5+ TODO items
- Task requires research and implementation
- Task is self-contained and well-defined
- You need to maintain focus on high-level coordination

### 6. Verification Before Completion

Before considering the task complete:

- [ ] All TODO items are checked off (or all phases completed)
- [ ] All tests pass
- [ ] No linter errors
- [ ] Documentation is updated
- [ ] Changes are committed and pushed (if applicable)
