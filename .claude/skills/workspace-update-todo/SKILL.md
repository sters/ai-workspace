---
name: workspace-update-todo
description: Add, remove, or modify TODO items
---

# workspace-update-todo

## Overview

This skill updates TODO items in a workspace's TODO file. It delegates the actual update work to the `workspace-repo-todo-updater` agent.

**After completion:** Use `/workspace-execute` to work through the updated TODO items.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/TODO-{repository-name}.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Validate Workspace and Repository

**Required**: User must specify the workspace and TODO file (or repository name).

- If workspace or TODO file is **not specified**, abort with message:
  > Please specify a workspace and TODO file. Example: `/workspace-update-todo workspace/feature-user-auth-20260116 TODO-auth-service.md`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`
- TODO file format: `TODO-{repository-name}.md` or just `{repository-name}`

### 2. Delegate to Agent

Pass the user's request **as-is** to the agent. Do NOT convert to TODO format yourself.

The agent will:
- Analyze the repository if the request is abstract
- Convert abstract requests (e.g., "add error handling") to specific TODOs
- Apply concrete requests directly

### 3. Invoke Agent

Invoke the `workspace-repo-todo-updater` agent:

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

### 4. Coordinate Multi-Repository Dependencies (if applicable)

After the updater agent completes, **if the workspace has multiple repositories**, invoke the coordinator to re-optimize dependencies:

```yaml
Task tool:
  subagent_type: workspace-todo-coordinator
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
```

**What the agent does (defined in agent, not by prompt):**
- Reads all TODO files
- Analyzes cross-repository dependencies
- Restructures for parallel execution

Skip this step for single-repository workspaces.

### 5. Report Results

After all agents complete, summarize the changes to the user.

## Example Usage

### Add a new TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Add a TODO item to implement error handling
Assistant: [Validates input, delegates to agent, reports results]
```

### Remove a TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Remove the TODO about adding comments
Assistant: [Validates input, delegates to agent, reports results]
```

### Modify a TODO item

```
User: /workspace-update-todo feature-user-auth auth-service Change the priority of the testing task
Assistant: [Validates input, delegates to agent, reports results]
```

## Next Steps - Ask User to Proceed

After TODO update is complete, **always ask the user** whether to proceed with the next step using AskUserQuestion:

```yaml
AskUserQuestion tool:
  questions:
    - question: "TODO file updated. Would you like to proceed with executing the updated TODO items?"
      header: "Next Step"
      multiSelect: false
      options:
        - label: "Execute now"
          description: "Run /workspace-execute to work through TODO items immediately"
        - label: "Skip for now"
          description: "I'll review the changes first and execute later"
```

If the user selects "Execute now", invoke the `/workspace-execute` skill using the Skill tool.

## Notes

- The agent automatically removes completed items (`[x]`) to keep the file compact
- The agent commits changes automatically after updating
