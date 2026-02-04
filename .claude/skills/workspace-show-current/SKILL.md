---
name: workspace-show-current
description: Show the workspace currently focused in this conversation
---

# workspace-show-current

## Overview

This skill displays which workspace is currently being focused in this conversation context. No additional responses or actions.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

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
