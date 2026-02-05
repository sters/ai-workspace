---
name: workspace-prune
description: Delete workspaces not modified within N days
---

# workspace-prune

## Overview

This skill identifies workspaces that have not been modified within a specified number of days and allows batch deletion after user confirmation.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

## Steps

### 1. List Stale Workspaces

Run the script to find stale workspaces:

```bash
./.claude/skills/workspace-prune/scripts/list-stale-workspaces.sh [days]
```

Default threshold is 7 days. The user can specify a different threshold (e.g., `/workspace-prune 14` for 14 days).

### 2. Display Stale Workspaces

Show the list of stale workspaces:

```
workspace/feature-old-task-20260110/ (2026-01-10)
workspace/bugfix-issue-20260115/ (2026-01-15)
```

### 3. Confirm Deletion

Use AskUserQuestion to confirm:

- Option 1: Delete all stale workspaces
- Option 2: Cancel

### 4. Delete Selected Workspaces

For each workspace to delete, run:

```bash
./.claude/skills/workspace-delete/scripts/workspace-delete.sh {workspace-name}
```

### 5. Report Results

Show a summary of deleted workspaces.

## Notes

- Default threshold is 7 days; user can override with argument
- Always confirm before deletion
- Uses the existing delete-workspace script for actual deletion
