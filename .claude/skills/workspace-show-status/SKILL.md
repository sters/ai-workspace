---
name: workspace-show-status
description: Show TODO progress and background agent status for the current workspace
---

# workspace-show-status

## Overview

This skill displays the current workspace status including TODO progress and background agent status.

## Steps

### 1. Identify Current Workspace from Context

Review the current conversation to determine which workspace is being worked on. Look for:

- Workspace initialized via `/workspace-init`
- Workspace specified in `/workspace-execute`, `/workspace-review-changes`, or `/workspace-create-pr`
- Any explicit workspace directory mentioned by the user

If no workspace is focused, output "No workspace focused" and stop.

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
- Progress: XX%

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
