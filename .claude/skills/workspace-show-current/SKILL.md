---
name: workspace-show-current
description: Display the specified workspace path
---

# workspace-show-current

## Overview

This skill displays the specified workspace path. Use this to confirm or set which workspace you're working with. Output only, no additional responses or actions.

**Paths:** Use relative paths from project root (see CLAUDE.md for details).

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-show-current workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Output

Display only the current workspace path. No commentary, suggestions, or follow-up questions.

Refer to `.claude/skills/workspace-show-current/templates/output.md` for the output format.

## Notes

- Output only the workspace path or "No workspace focused"
- Do not provide any additional responses, suggestions, or questions
- Do not explain what the workspace is or what to do next
- This is based on conversation context, not filesystem listing
