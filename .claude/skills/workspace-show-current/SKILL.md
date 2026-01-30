---
name: workspace-show-current
description: Show the workspace currently focused in this conversation
---

# workspace-show-current

## Overview

This skill displays which workspace is currently being focused in this conversation context. No additional responses or actions.

## Steps

### 1. Identify Current Workspace from Context

Review the current conversation to determine which workspace is being worked on. Look for:

- Workspace initialized via `/workspace-init`
- Workspace specified in `/workspace-execute`, `/workspace-review-changes`, or `/workspace-create-pr`
- Any explicit workspace directory mentioned by the user

### 2. Output

Display only the current workspace path. No commentary, suggestions, or follow-up questions.

Refer to `.claude/skills/workspace-show-current/templates/output.md` for the output format.

## Notes

- Output only the workspace path or "No workspace focused"
- Do not provide any additional responses, suggestions, or questions
- Do not explain what the workspace is or what to do next
- This is based on conversation context, not filesystem listing
