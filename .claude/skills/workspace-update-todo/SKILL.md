---
name: workspace-update-todo
description: Update TODO items in a workspace repository
---

# update-workspace-todo

## Overview

This skill updates TODO items in a workspace's TODO file. It supports adding, removing, and modifying TODO items while preserving completed items.

## Steps

### 1. Identify the Workspace and Repository

- If the user specifies a workspace and repository, use those
- If not specified, ask the user or list available options:

```bash
# List workspaces
ls -d workspace/*/

# List TODO files in a workspace
ls workspace/{workspace-name}/TODO-*.md
```

### 2. Understand the Update Request

Determine what kind of update the user wants:

- **Add**: Add new TODO items
- **Remove**: Remove existing TODO items (only uncompleted items)
- **Modify**: Change existing TODO items (description, order, etc.)

### 3. Read Current TODO File

Read the TODO file to understand the current state:

```bash
# TODO file path
workspace/{workspace-name}/TODO-{repository-name}.md
```

### 4. Apply Updates

Apply the requested changes to the TODO file.

**Important constraints:**
- **NEVER delete completed TODO items** (items marked with `[x]`)
- Preserve the overall structure of the TODO file
- Keep completed items in their original location for history

**For adding items:**
- Add to the appropriate section
- Follow the existing format and style

**For removing items:**
- Only remove uncompleted items (items marked with `[ ]`)
- If the user requests to remove a completed item, warn them and skip it

**For modifying items:**
- Update the description or details as requested
- Preserve the completion status

### 5. Confirm Changes

After updating, summarize what was changed:

```
## TODO Updated

**File**: workspace/{workspace-name}/TODO-{repository-name}.md

**Changes**:
- Added: {count} items
- Removed: {count} items
- Modified: {count} items

**Details**:
- Added: "{item description}"
- Removed: "{item description}"
- Modified: "{old}" → "{new}"
```

### 6. Commit Workspace Snapshot

After updating the TODO file, commit the changes:

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 7. Suggest Next Steps

If `workspace-repo-todo-executor` is not currently running, suggest executing the workspace:

```
**Next step**: Run `/workspace-execute` to work through the updated TODO items.
```

## Example Usage

### Add a new TODO item

```
User: Add a TODO item to implement error handling in the auth module
Assistant: [Identifies workspace and repo, adds the item to the TODO file]
```

### Remove a TODO item

```
User: Remove the TODO about adding comments
Assistant: [Checks if item is completed, removes if not]
```

### Modify a TODO item

```
User: Change the priority of the testing task
Assistant: [Updates the item's position or description]
```

## Notes

- Always read the TODO file before making changes to avoid conflicts
- Completed items are historical records and must be preserved
- Follow the existing formatting style in the TODO file
