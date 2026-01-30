---
name: show-current-workspace
description: Show the current workspace directory
---

# show-current-workspace

## Overview

This skill displays the current workspace directory. No additional responses or actions.

## Steps

### 1. List Workspaces

Run the following command and display the output:

```bash
ls -d workspace/*/ 2>/dev/null || echo "No workspace found"
```

### 2. Output

Display only the list of workspace directories. Do not add any commentary, suggestions, or follow-up questions.

## Output Format

```
workspace/feature-example-20260130/
workspace/bugfix-login-20260129/
```

Or if no workspace exists:

```
No workspace found
```

## Notes

- Output only the workspace list
- Do not provide any additional responses, suggestions, or questions
- Do not explain what the workspaces are or what to do next
