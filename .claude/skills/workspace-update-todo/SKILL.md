---
name: workspace-update-todo
description: Update TODO items in a workspace repository
---

# workspace-update-todo

## Overview

This skill updates TODO items in a workspace's TODO file. It delegates the actual update work to the `workspace-repo-todo-updater` agent.

**After completion:** Use `/workspace-execute` to work through the updated TODO items.

## Steps

### 1. Validate Workspace and Repository

**Required**: User must specify the workspace and TODO file (or repository name).

- If workspace or TODO file is **not specified**, abort with message:
  > Please specify a workspace and TODO file. Example: `/workspace-update-todo workspace/feature-user-auth-20260116 TODO-auth-service.md`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`
- TODO file format: `TODO-{repository-name}.md` or just `{repository-name}`

### 2. Parse Update Request

Identify what the user wants to change:
- **Add**: Add new TODO items
- **Remove**: Remove existing TODO items
- **Modify**: Change existing TODO items

### 3. Delegate to Agent

Invoke the `workspace-repo-todo-updater` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-updater
  run_in_background: true
  prompt: |
    Update TODO items in workspace repository.
    Workspace Name: {workspace-name}
    Repository Name: {repository-name}
    Update Request: {what the user wants to change}
```

### 4. Report Results

After the agent completes, summarize the changes to the user.

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

- The agent will preserve completed items (items marked with `[x]`)
- Only uncompleted items can be removed
- The agent commits changes automatically after updating
