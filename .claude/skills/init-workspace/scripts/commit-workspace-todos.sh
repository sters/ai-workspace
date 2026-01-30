#!/bin/bash
# Commit TODO files in a workspace
# Usage: commit-workspace-todos.sh <workspace-path>

set -e

WORKSPACE_PATH="$1"

if [ -z "$WORKSPACE_PATH" ]; then
    echo "Error: Workspace path is required" >&2
    echo "Usage: $0 <workspace-path>" >&2
    exit 1
fi

if [ ! -d "$WORKSPACE_PATH" ]; then
    echo "Error: Workspace not found: $WORKSPACE_PATH" >&2
    exit 1
fi

cd "$WORKSPACE_PATH"

# Check if there are TODO files to commit
if ! ls TODO-*.md 1> /dev/null 2>&1; then
    echo "Error: No TODO-*.md files found in workspace" >&2
    exit 1
fi

# Stage TODO files and README
git add TODO-*.md README.md

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Commit
git commit -m "Add TODO items for all repositories"

echo "TODO files committed successfully"
