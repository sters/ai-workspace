---
name: execute-workspace
description: Execute tasks in an initialized workspace by working through TODO items
---

# execute-workspace

## Overview

This skill executes work in an initialized workspace by delegating to the `workspace-repo-todo-executor` agent for each repository. It works through TODO items, runs tests/linters, and commits changes.

**Prerequisites:** The workspace must be initialized first using `/init-workspace`.

## Steps

### 1. Identify the Workspace

- If the user specifies a workspace directory, use that
- If not specified, ask the user which workspace they want to execute
- List available workspaces if needed:

```bash
ls -d workspace/*/
```

### 2. Identify Repositories

Find all repository worktrees in the workspace:

```bash
ls -d workspace/{workspace-name}/*/
```

For each repository directory, extract:
- Repository path (e.g., `github.com/sters/complex-ai-workspace`)
- Repository name (e.g., `complex-ai-workspace`)

### 3. Delegate to workspace-repo-todo-executor Agent

For each repository in the workspace, use the Task tool to launch the `workspace-repo-todo-executor` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-executor
  run_in_background: true
  prompt: |
    Execute tasks in workspace: workspace/{workspace-name}
    Repository path: {org/repo-path}
    Repository name: {repo-name}
    Repository worktree path: workspace/{workspace-name}/{org}/{repo}
```

**What the agent does:**

- Reads README.md and `TODO-{repository-name}.md` to understand the task
- Executes TODO items sequentially
- Updates the TODO file as items are completed
- Runs tests and linters
- Makes commits with descriptive messages
- Reports completion summary

**Important**: Launch agents in parallel if there are multiple repositories.

### 4. Report Results

After all agents complete, report the execution summary to the user:

- Completed TODO items count
- Remaining TODO items (if any)
- Test/lint status
- Commits made

## Example Usage

### Example 1: Execute Current Workspace

```
User: Execute the tasks in my workspace
Assistant: Let me identify the workspace and execute the TODO items...
[Identifies repositories, launches executor agents]
[After completion]
Execution complete! Completed 8 TODO items across 2 repositories.
```

### Example 2: Execute Specific Workspace

```
User: Execute workspace/feature-user-auth-20260116
Assistant: I'll execute the tasks in workspace/feature-user-auth-20260116...
[Launches executor agent for each repository]
[After completion]
All TODO items completed. Tests passing, no lint errors.
```

## Notes

- The skill delegates actual work to the `workspace-repo-todo-executor` agent
- Each repository is processed by its own agent instance
- The agent handles test execution, linting, and commits autonomously
