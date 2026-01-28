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

echo "=== REMOVING WORKTREES ==="

# Find and remove git worktrees
for REPO_DIR in "$WORKSPACE_DIR"/*/*; do
    if [ -d "$REPO_DIR/.git" ] || [ -f "$REPO_DIR/.git" ]; then
        # Extract the repository path from worktree
        # Worktree path: workspace/{name}/{org}/{repo}
        # Repository path: repositories/{org}/{repo}
        REL_PATH=${REPO_DIR#"$WORKSPACE_DIR/"}
        REPO_PATH="repositories/${REL_PATH}"

        if [ -d "$REPO_PATH" ]; then
            echo "Removing worktree: $REPO_DIR"
            git -C "$REPO_PATH" worktree remove "$REPO_DIR" --force 2>/dev/null || {
                echo "Warning: Could not remove worktree via git, will delete directory directly"
            }
        else
            echo "Warning: Repository not found: $REPO_PATH"
        fi
    fi
done

echo ""
echo "=== REMOVING WORKSPACE DIRECTORY ==="
rm -rf "$WORKSPACE_DIR"
echo "Deleted: $WORKSPACE_DIR"

echo ""
echo "=== DELETION COMPLETE ==="
