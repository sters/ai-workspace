---
name: workspace-list
description: List all workspaces in the workspace directory
---

# show-workspaces

## Overview

This skill lists all existing workspaces in the `workspace/` directory using a shell script. Output only the list, no additional responses or actions.

## Steps

### 1. Run the List Script

Execute the following script:

```bash
./.claude/skills/workspace-list/scripts/list-workspaces.sh
```

### 2. Output

Display the script output as-is. No commentary, suggestions, or follow-up questions.

## Output Format

If workspaces exist:

```
workspace/feature-auth-20260130/
workspace/bugfix-login-20260129/
workspace/research-api-20260128/
```

If no workspaces exist:

```
No workspaces found
```

## Notes

- Output only the script result
- Do not provide any additional responses, suggestions, or questions
- Do not explain what each workspace is or what to do next
