---
name: workspace-show-status
description: "Show TODO progress and background agent status for a workspace. Use to check how far along an existing workspace is before deciding next steps."
context: fork
---

# workspace-show-status

## Overview

This skill displays the current workspace status including TODO progress and background agent status.

**Paths:** Use relative paths from project root (see CLAUDE.md for details).

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-show-status workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Check TODO Progress

Run the status check script:

```bash
.claude/skills/workspace-show-status/scripts/check-status.sh {workspace-name}
```

### 3. Check Background Agents

Use the `/tasks` command or check running background tasks to see agent status.

### 4. Output Format

Display in the following format:

```
## Current Workspace
workspace/{workspace-name}/

## TODO Progress
### TODO-{repo-name}.md
- Completed: X
- Incomplete: Y
- In Progress: Z
- Blocked: B
- Progress: XX%

Blocked items:
- [!] Item that is blocked (reason)

In-progress items:
- [~] Item currently being worked on

Incomplete items:
- [ ] Item 1
- [ ] Item 2

## Background Agents
- workspace-repo-todo-executor: running / completed / not started
- workspace-repo-review-changes: running / completed / not started
```

## Notes

- Display only the status information
- Keep the output concise and structured
- Show incomplete TODO items (up to 5) if any exist
- `[!]` marks blocked items — items the executor could not complete due to unresolved issues
- `[~]` marks in-progress items — items currently being worked on by a background agent
