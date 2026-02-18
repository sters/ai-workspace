#!/bin/bash
# Check for existing PR and fetch its details
# Usage: get-existing-pr-info.sh <workspace-name> <repository-path>
#
# If PR exists:
#   - Stdout line 1: "exists"
#   - Stdout line 2: PR URL
#   - Stdout line 3: PR title
#   - Writes existing body to workspace/{name}/tmp/existing-pr-body-{repo-name}.md
#
# If no PR:
#   - Stdout line 1: "none"

set -e

WORKSPACE_NAME="$1"
REPO_PATH="$2"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$REPO_PATH" ]; then
    echo "Error: Workspace name and repository path are required" >&2
    echo "Usage: $0 <workspace-name> <repository-path>" >&2
    exit 1
fi

WORKTREE_PATH="workspace/${WORKSPACE_NAME}/${REPO_PATH}"
REPO_NAME=$(basename "$REPO_PATH")

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Repository worktree not found: $WORKTREE_PATH" >&2
    exit 1
fi

PROJECT_ROOT="$(pwd)"

cd "$WORKTREE_PATH"

CURRENT_BRANCH=$(git branch --show-current)

if PR_JSON=$(gh pr view "$CURRENT_BRANCH" --json url,title,body 2>/dev/null); then
    PR_URL=$(echo "$PR_JSON" | jq -r '.url')
    PR_TITLE=$(echo "$PR_JSON" | jq -r '.title')
    PR_BODY=$(echo "$PR_JSON" | jq -r '.body')

    # Write existing body to workspace tmp
    BODY_DIR="${PROJECT_ROOT}/workspace/${WORKSPACE_NAME}/tmp"
    mkdir -p "$BODY_DIR"
    echo "$PR_BODY" > "${BODY_DIR}/existing-pr-body-${REPO_NAME}.md"

    echo "exists"
    echo "$PR_URL"
    echo "$PR_TITLE"
else
    echo "none"
fi
