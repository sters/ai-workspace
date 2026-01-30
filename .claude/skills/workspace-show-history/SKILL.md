---
name: workspace-show-history
description: Show git history of a workspace (README/TODO changes over time)
---

# workspace-show-history

## Overview

This skill shows the git commit history of a workspace, displaying how README and TODO files have changed over time.

## Steps

### 1. Identify the Workspace

- If the user specifies a workspace, use that
- If not specified, use the current workspace context or ask the user

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
