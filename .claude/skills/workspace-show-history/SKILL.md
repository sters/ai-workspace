---
name: workspace-show-history
description: Show commit history of README/TODO changes
---

# workspace-show-history

## Overview

This skill shows the git commit history of a workspace, displaying how README and TODO files have changed over time.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-show-history workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Run the History Script

Execute the following script:

```bash
./.claude/skills/workspace-show-history/scripts/workspace-show-history.sh {workspace-name}
```

For detailed diff output, add `--full`:

```bash
./.claude/skills/workspace-show-history/scripts/workspace-show-history.sh {workspace-name} --full
```

### 3. Output

Display the script output as-is. No additional commentary unless the user asks for explanation.

Refer to `.claude/skills/workspace-show-history/templates/output.md` for the output format.

## Notes

- Works only on workspaces created with git tracking enabled
- Older workspaces (before git tracking) will show an error message
