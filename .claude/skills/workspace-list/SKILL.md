---
name: workspace-list
description: List all workspaces
---

# workspace-list

## Overview

This skill lists all existing workspaces in the `workspace/` directory using a shell script. Output only the list, no additional responses or actions.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

## Steps

### 1. Run the List Script

Execute the following script:

```bash
./.claude/scripts/list-workspaces.sh
```

### 2. Output

Display the script output as-is. No commentary, suggestions, or follow-up questions.

Refer to `.claude/skills/workspace-list/templates/output.md` for the output format.

## Notes

- Output only the script result
- Do not provide any additional responses, suggestions, or questions
- Do not explain what each workspace is or what to do next
