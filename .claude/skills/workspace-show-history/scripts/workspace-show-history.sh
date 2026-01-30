#!/bin/bash

set -e

# Usage: ./workspace-show-history.sh <workspace-name> [--full]
# Example: ./workspace-show-history.sh feature-auth-20260130
# Example: ./workspace-show-history.sh feature-auth-20260130 --full
#
# Shows git history of the workspace (README/TODO changes over time).
# Use --full to show detailed diff for each commit.

WORKSPACE_NAME="$1"
SHOW_FULL="$2"

if [ -z "$WORKSPACE_NAME" ]; then
    echo "Usage: $0 <workspace-name> [--full]"
    echo "Example: $0 feature-auth-20260130"
    exit 1
fi

WORKSPACE_DIR="workspace/${WORKSPACE_NAME}"

if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace directory not found: $WORKSPACE_DIR"
    exit 1
fi

cd "$WORKSPACE_DIR"

# Check if workspace is a git repository
if [ ! -d ".git" ]; then
    echo "Error: Workspace is not a git repository"
    echo "This workspace was created before git tracking was enabled."
    exit 1
fi

# WORKSPACE_NAME is already set from input
echo "=== Workspace History: $WORKSPACE_NAME ==="
echo ""

# Show current TODO status
echo "--- Current Status ---"
for TODO_FILE in TODO-*.md; do
    if [ -f "$TODO_FILE" ]; then
        INCOMPLETE=$(grep -c '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null) || INCOMPLETE=0
        COMPLETE=$(grep -c '^\s*- \[x\]' "$TODO_FILE" 2>/dev/null) || COMPLETE=0
        TOTAL=$((INCOMPLETE + COMPLETE))
        echo "$TODO_FILE: ${COMPLETE}/${TOTAL} completed"
    fi
done
echo ""

# Show commit history
echo "--- Commit History ---"
if [ "$SHOW_FULL" = "--full" ]; then
    git log --pretty=format:"%h %ad | %s" --date=short --stat
else
    git log --pretty=format:"%h %ad | %s" --date=short
fi
echo ""
