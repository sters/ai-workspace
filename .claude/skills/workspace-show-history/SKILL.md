---
name: workspace-show-history
description: Show git history of a workspace (README/TODO changes over time)
---

# show-workspace-history

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

## Output Format

```
=== Workspace History: feature-auth-20260130 ===

--- Current Status ---
TODO-repo.md: 5/8 completed

--- Commit History ---
a1b2c3d 2026-01-30 | Snapshot: 5/8 TODO items completed
e4f5g6h 2026-01-30 | Snapshot: 3/8 TODO items completed | reviews updated
i7j8k9l 2026-01-30 | Initial: feature-auth-20260130 workspace created
```

## Notes

- Works only on workspaces created with git tracking enabled
- Older workspaces (before git tracking) will show an error message
