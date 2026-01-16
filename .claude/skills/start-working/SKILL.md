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
- Target repository path in org/repo format (e.g., github.com/sters/complex-ai-workspace)
- Base branch (optional - will be auto-detected if not specified)
- Ticket ID (optional)

### 2. Run Setup Script

Execute the setup script with the required parameters:

```bash
./.claude/skills/start-working/scripts/setup-workspace.sh <task-type> <description> <org/repo-name> [base-branch] [ticket-id]
```

**Examples:**

```bash
# Auto-detect base branch
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace

# Specify base branch
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace main

# With ticket ID
./.claude/skills/start-working/scripts/setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace main PROJ-123

# Bug fix with auto-detected branch
./.claude/skills/start-working/scripts/setup-workspace.sh bugfix login-error github.com/sters/complex-ai-workspace

# Research task with specific branch
./.claude/skills/start-working/scripts/setup-workspace.sh research performance-analysis github.com/sters/complex-ai-workspace develop
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

**Handling User Requests During Execution:**

When the user provides additional requirements or requests changes during execution, the **main orchestrating agent** (not the sub-agent) should:

- Read the corresponding `TODO-<repository-name>.md` file
- Add new TODO items or update existing ones to reflect the new requirements
- Update the README.md if the task scope or objectives has changed
- Either continue execution directly or re-delegate to the workspace-repo-todo-executor sub-agent with updated context

Note: The sub-agent operates autonomously on the TODO list and does not handle interactive user requests. User interactions should be handled by the main agent before delegation.

### 5. Delegate to workspace-repo-todo-executor SubAgent

Use the `workspace-repo-todo-executor` sub-agent to autonomously execute TODO items, run tests/linters, and commit changes.

**How to invoke:**

Use the Task tool to launch the workspace-repo-todo-executor agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-executor
  prompt: |
    Execute tasks in workspace: workspace/feature-user-auth-20260116
    Repository path: github.com/sters/complex-ai-workspace
    Repository name: complex-ai-workspace
    Repository worktree path: workspace/feature-user-auth-20260116/github.com/sters/complex-ai-workspace
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
