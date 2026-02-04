---
name: workspace-show-status
description: Show TODO progress and background agent status for the current workspace
---

# workspace-show-status

## Overview

This skill displays the current workspace status including TODO progress and background agent status.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/TODO-*.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

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
