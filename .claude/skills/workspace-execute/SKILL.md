---
name: workspace-execute
description: Execute tasks in an initialized workspace by working through TODO items
---

# workspace-execute

## Overview

This skill executes work in an initialized workspace by delegating to the `workspace-repo-todo-executor` agent for each repository. It works through TODO items, runs tests/linters, and commits changes.

**Prerequisites:** The workspace must be initialized first using `/workspace-init`.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/README.md`
- `workspace/{workspace-name}/TODO-{repository-name}.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-execute workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

For each repository, extract:
- Repository path (e.g., `github.com/sters/complex-ai-workspace`)
- Repository name (e.g., `complex-ai-workspace`)

### 3. Delegate to workspace-repo-todo-executor Agent

For each repository in the workspace, use the Task tool to launch the `workspace-repo-todo-executor` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-executor
  run_in_background: true
  prompt: |
    Execute tasks in workspace: {workspace-name}
    Repository path: {org/repo-path}
    Repository name: {repo-name}
```

**What the agent does:**

- Reads README.md and `TODO-{repository-name}.md` to understand the task
- Executes TODO items sequentially
- Updates the TODO file as items are completed
- Runs tests and linters
- Makes commits with descriptive messages
- Reports completion summary

**Important**: Launch agents in parallel if there are multiple repositories.

### 4. Commit Workspace Snapshot

After all agents complete, commit the workspace changes:

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 5. Report Results

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

## Next Steps - Ask User to Proceed

After execution is complete, **always ask the user** whether to proceed with the next step using AskUserQuestion:

```yaml
AskUserQuestion tool:
  questions:
    - question: "Task execution complete. Would you like to review the code changes before creating a PR?"
      header: "Next Step"
      multiSelect: false
      options:
        - label: "Review changes (Recommended)"
          description: "Run /workspace-review-changes to check for issues before PR"
        - label: "Skip review, create PR"
          description: "Proceed directly to /workspace-create-pr"
        - label: "Done for now"
          description: "I'll continue manually later"
```

Based on the user's selection:
- "Review changes" → Invoke the `/workspace-review-changes` skill using the Skill tool
- "Skip review, create PR" → Invoke the `/workspace-create-pr` skill using the Skill tool
- "Done for now" → End the workflow

## Notes

- The skill delegates actual work to the `workspace-repo-todo-executor` agent
- Each repository is processed by its own agent instance
- The agent handles test execution, linting, and commits autonomously
