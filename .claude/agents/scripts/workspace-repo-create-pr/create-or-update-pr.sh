#!/bin/bash
# Create or update a pull request
# Usage: create-or-update-pr.sh <workspace-name> <repository-path> <title> <body-file> [--no-draft]
# Output: "created" or "updated" on first line, PR URL on second line
#
# Note: body-file should be a path relative to repository root or absolute path

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_NAME="$1"
REPO_PATH="$2"
TITLE="$3"
BODY_FILE="$4"
NO_DRAFT="$5"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$REPO_PATH" ] || [ -z "$TITLE" ] || [ -z "$BODY_FILE" ]; then
    echo "Error: Workspace name, repository path, title, and body file are required" >&2
    echo "Usage: $0 <workspace-name> <repository-path> <title> <body-file> [--no-draft]" >&2
    exit 1
fi

WORKTREE_PATH="workspace/${WORKSPACE_NAME}/${REPO_PATH}"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Repository worktree not found: $WORKTREE_PATH" >&2
    exit 1
fi

if [ ! -f "$BODY_FILE" ]; then
    echo "Error: Body file not found: $BODY_FILE" >&2
    exit 1
fi

cd "$WORKTREE_PATH"

# Push current branch if needed
CURRENT_BRANCH=$(git branch --show-current)
if ! git ls-remote --exit-code --heads origin "$CURRENT_BRANCH" >/dev/null 2>&1; then
    echo "Pushing branch to remote..." >&2
    git push -u origin "$CURRENT_BRANCH"
else
    # Branch exists, push any new commits
    git push origin "$CURRENT_BRANCH" 2>/dev/null || true
fi

# Check if PR already exists (pass worktree path to subscript)
CHECK_RESULT=$("$SCRIPT_DIR/check-existing-pr.sh" "$WORKTREE_PATH" 2>/dev/null || echo "none")
PR_EXISTS=$(echo "$CHECK_RESULT" | head -n1)

# Convert body-file to absolute path for subscripts
BODY_FILE_ABS="$(cd "$(dirname "$BODY_FILE")" && pwd)/$(basename "$BODY_FILE")"

if [ "$PR_EXISTS" = "exists" ]; then
    # Update existing PR
    PR_URL=$("$SCRIPT_DIR/update-pr.sh" "$WORKTREE_PATH" "$TITLE" "$BODY_FILE_ABS")
    echo "updated"
    echo "$PR_URL"
else
    # Create new PR
    PR_URL=$("$SCRIPT_DIR/create-pr.sh" "$WORKTREE_PATH" "$TITLE" "$BODY_FILE_ABS" "$NO_DRAFT")
    echo "created"
    echo "$PR_URL"
fi
