#!/bin/bash
# Delete a workspace and its worktrees
# Usage: delete-workspace.sh <workspace-name>
# Output: Deletion status

set -e

WORKSPACE_NAME="$1"

if [ -z "$WORKSPACE_NAME" ]; then
    echo "Error: Workspace name is required" >&2
    echo "Usage: $0 <workspace-name>" >&2
    exit 1
fi

WORKSPACE_DIR="workspace/${WORKSPACE_NAME}"

if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace directory not found: $WORKSPACE_DIR" >&2
    exit 1
fi

echo "=== COLLECTING REPOSITORY PATHS ==="

# Collect repository paths that have worktrees in this workspace
REPO_PATHS=()
for REPO_DIR in "$WORKSPACE_DIR"/*/*; do
    if [ -d "$REPO_DIR/.git" ] || [ -f "$REPO_DIR/.git" ]; then
        REL_PATH=${REPO_DIR#"$WORKSPACE_DIR/"}
        REPO_PATH="repositories/${REL_PATH}"
        if [ -d "$REPO_PATH" ]; then
            REPO_PATHS+=("$REPO_PATH")
            echo "Found worktree: $REPO_DIR"
        fi
    fi
done

echo ""
echo "=== REMOVING WORKSPACE DIRECTORY ==="
rm -rf "$WORKSPACE_DIR"
echo "Deleted: $WORKSPACE_DIR"

echo ""
echo "=== PRUNING WORKTREE REFERENCES ==="
# Prune stale worktree references in batch (much faster than individual worktree remove)
for REPO_PATH in "${REPO_PATHS[@]}"; do
    git -C "$REPO_PATH" worktree prune 2>/dev/null || true
    echo "Pruned: $REPO_PATH"
done

echo ""
echo "=== DELETION COMPLETE ==="
