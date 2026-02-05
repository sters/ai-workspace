---
name: workspace-delete
description: Delete a workspace (with confirmation)
---

# workspace-delete

## Overview

This skill safely deletes a workspace by first showing its status and confirming with the user. It ensures the user is aware of any incomplete work before deletion.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/README.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-delete workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Check Workspace Status

Run the script to gather workspace status:

```bash
.claude/skills/workspace-delete/scripts/check-workspace-status.sh {workspace-name}
```

The script outputs:
- Last activity date and file
- TODO status (completed/incomplete counts per file)
- List of incomplete items

### 3. Read Workspace Overview

Read the README.md to understand the workspace context:

```bash
cat workspace/{workspace-name}/README.md
```

### 4. Display Status to User

Refer to `.claude/skills/workspace-delete/templates/workspace-status.md` for the format.

Fill in the placeholders with the collected information.

If there are incomplete TODO items, include a warning:

```
⚠️ **Warning**: This workspace has {count} incomplete TODO items.
Deleting this workspace will lose track of this pending work.
```

### 5. Confirm Deletion

Ask the user for confirmation using the AskUserQuestion tool:

- If incomplete items exist: Require explicit confirmation
- If all items complete: Still confirm but with less urgency

### 6. Delete the Workspace

If the user confirms, run the deletion script:

```bash
.claude/skills/workspace-delete/scripts/workspace-delete.sh {workspace-name}
```

The script:
1. Removes git worktrees (to clean up git references)
2. Deletes the workspace directory

### 7. Confirm Deletion

Report the result to the user.

Refer to `.claude/skills/workspace-delete/templates/deletion-confirmed.md` for the format.

## Example Usage

```
User: Delete workspace feature-user-auth-20260116
Assistant: Let me check the workspace status first...

## Workspace Status

**Workspace**: feature-user-auth-20260116
**Last Activity**: 2026-01-16 15:30:00

### Overview
Task: Implement user authentication
Created: 2026-01-16

### TODO Status

#### TODO-auth-service.md
- Completed: 5
- Incomplete: 2
  - [ ] Add rate limiting
  - [ ] Write integration tests

⚠️ **Warning**: This workspace has 2 incomplete TODO items.

Are you sure you want to delete this workspace?

User: Yes, delete it
Assistant: [Deletes workspace and confirms]
```

## Notes

- Always remove git worktrees before deleting the directory to avoid orphaned references
- Incomplete TODO items are listed to help the user make an informed decision
- The deletion is irreversible, so confirmation is mandatory
