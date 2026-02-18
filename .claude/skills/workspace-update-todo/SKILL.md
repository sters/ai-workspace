---
name: workspace-update-todo
description: Add, remove, or modify TODO items
---

# workspace-update-todo

## Overview

This skill updates TODO items in a workspace's TODO file. It delegates the actual update work to the `workspace-repo-todo-updater` agent.

**After completion:** Use `/workspace-execute` to work through the updated TODO items.

**Paths:** Use relative paths from project root for all workspace file operations (see CLAUDE.md for details).

## Arguments

This skill receives `$ARGUMENTS` from the caller. Parse to extract:
- Workspace name (required)
- Repository name or TODO file name (required)
- Update request (required): what to add, remove, or modify
- Example: `feature-user-auth auth-service Add error handling to all endpoints`
- Example: `feature-user-auth TODO-api.md Remove the caching TODO`

If `$ARGUMENTS` is missing workspace or repository, abort with message:
> Please specify a workspace and TODO file. Example: `/workspace-update-todo feature-user-auth auth-service Add error handling`

## Steps

### 1. Delegate to Agent

Pass the user's request **as-is** to the agent. Do NOT convert to TODO format yourself.

The agent will:
- Analyze the repository if the request is abstract
- Convert abstract requests (e.g., "add error handling") to specific TODOs
- Apply concrete requests directly

### 2. Launch Updater Agent

Invoke the `workspace-repo-todo-updater` agent in background:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-updater
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {repository-name}
    Update Request: {what the user wants to change}
```

**What the agent does (defined in agent, not by prompt):**
- Reads the current TODO file
- Applies the requested changes
- Removes completed items automatically
- Commits the changes

**Do NOT wait for the agent to complete.** Proceed immediately to Step 3.

### 3. Report Agent Launched

Report the launched agent to the user immediately.

- TODO file being updated
- Summary of requested changes

## Example Usage

### Add a new TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Add a TODO item to implement error handling
Assistant: [Validates input, launches updater agent in background]
         Launched updater agent for TODO-auth-service.md.
         Use /workspace-show-status to check when update is complete.
```

### Remove a TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Remove the TODO about adding comments
Assistant: [Validates input, launches updater agent in background]
         Launched updater agent for TODO-auth-service.md.
         Use /workspace-show-status to check when update is complete.
```

### Modify a TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Change the priority of the testing task
Assistant: [Validates input, launches updater agent in background]
         Launched updater agent for TODO-auth-service.md.
         Use /workspace-show-status to check when update is complete.
```

## After Completion

After launching the updater agent, report directly to the user:
- TODO file being updated
- Suggest `/workspace-show-status {workspace-name}` to check progress
- Do NOT invoke other skills automatically — let the user decide next steps

## Notes

- The agent automatically removes completed items (`[x]`) to keep the file compact
- The agent commits changes automatically after updating
- **Non-blocking**: This skill returns immediately after launching the updater agent. It does NOT wait for the agent to complete. Use `/workspace-show-status` to check progress. Once the update is done, proceed to `/workspace-execute`.
