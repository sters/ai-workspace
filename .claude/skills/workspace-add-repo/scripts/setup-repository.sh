#!/bin/bash

set -e

# Usage: ./setup-repository.sh <workspace-name> <org/repo-path>
# Example: ./setup-repository.sh feature-user-auth-20260131 github.com/org/repo
# Example: BASE_BRANCH=develop ./setup-repository.sh feature-user-auth-20260131 github.com/org/repo
#
# Alias syntax: Use :<alias> suffix to create multiple worktrees from the same repository
# Example: ./setup-repository.sh feature-user-auth-20260131 github.com/org/repo:dev
# Example: ./setup-repository.sh feature-user-auth-20260131 github.com/org/repo:prod
#
# The alias is converted to ___<alias> in directory names (e.g., repo___dev)
#
# Base branch is auto-detected from remote. To override, set BASE_BRANCH environment variable.

WORKSPACE_NAME="$1"
REPOSITORY_PATH_ARG="$2"
# BASE_BRANCH can be set via environment variable, otherwise it will be auto-detected

if [ -z "$WORKSPACE_NAME" ] || [ -z "$REPOSITORY_PATH_ARG" ]; then
    echo "Usage: $0 <workspace-name> <org/repo-path>"
    echo "Example: $0 feature-user-auth-20260131 github.com/org/repo"
    echo ""
    echo "Alias syntax: Use :<alias> suffix for multiple worktrees from same repo"
    echo "Example: $0 feature-user-auth-20260131 github.com/org/repo:dev"
    echo ""
    echo "Base branch is auto-detected. To override: BASE_BRANCH=develop $0 ..."
    exit 1
fi

# Parse alias syntax (e.g., github.com/org/repo:dev -> repo path + alias)
# Input uses ":" for convenience, directory uses "___" for filesystem safety
if [[ "$REPOSITORY_PATH_ARG" == *":"* ]]; then
    ACTUAL_REPO_PATH="${REPOSITORY_PATH_ARG%:*}"
    REPO_ALIAS="${REPOSITORY_PATH_ARG##*:}"
    # Convert to directory-safe format: github.com/org/repo___dev
    REPOSITORY_PATH_INPUT="${ACTUAL_REPO_PATH}___${REPO_ALIAS}"
    echo "==> Alias detected: $REPO_ALIAS"
    echo "==> Actual repository: $ACTUAL_REPO_PATH"
    echo "==> Directory path: $REPOSITORY_PATH_INPUT"
else
    ACTUAL_REPO_PATH="$REPOSITORY_PATH_ARG"
    REPOSITORY_PATH_INPUT="$REPOSITORY_PATH_ARG"
    REPO_ALIAS=""
fi

# Get the script directory and workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
REPOSITORIES_DIR="$WORKSPACE_ROOT/repositories"

# Construct workspace directory path
WORKING_DIR="$WORKSPACE_ROOT/workspace/$WORKSPACE_NAME"

# Validate workspace directory exists
if [ ! -d "$WORKING_DIR" ]; then
    echo "Error: Workspace directory does not exist: $WORKING_DIR"
    echo "Run setup-workspace.sh first to create the workspace."
    exit 1
fi

# Validate workspace has README.md
if [ ! -f "$WORKING_DIR/README.md" ]; then
    echo "Error: Workspace README.md not found: $WORKING_DIR/README.md"
    echo "The workspace may not be properly initialized."
    exit 1
fi

# Extract repository name from path (last component, includes alias if present)
REPOSITORY_NAME=$(basename "$REPOSITORY_PATH_INPUT")
# Use actual repo path for cloning (without alias)
REPOSITORY_PATH="$REPOSITORIES_DIR/$ACTUAL_REPO_PATH"

echo "==> Adding repository to workspace: $REPOSITORY_PATH_INPUT"

# Step 1: Clone or update repository (using actual repo path, not alias path)
if [ ! -d "$REPOSITORY_PATH" ]; then
    echo "==> Repository not found. Cloning from $ACTUAL_REPO_PATH..."
    # Generate clone URL from repository path (e.g., github.com/org/repo -> https://github.com/org/repo.git)
    REPO_URL="https://${ACTUAL_REPO_PATH}.git"
    echo "Clone URL: $REPO_URL"
    # Create parent directory structure
    mkdir -p "$(dirname "$REPOSITORY_PATH")"
    git clone "$REPO_URL" "$REPOSITORY_PATH"
    cd "$REPOSITORY_PATH"
    # Ensure origin/HEAD is set after clone
    git remote set-head origin --auto 2>/dev/null || true
else
    echo "==> Updating repository..."
    cd "$REPOSITORY_PATH"
    git fetch --all --prune
    # Set origin/HEAD to track the remote default branch
    git remote set-head origin --auto 2>/dev/null || true
    echo "Repository updated"
fi

# Step 2: Detect base branch if not specified
if [ -z "$BASE_BRANCH" ]; then
    echo "==> Detecting base branch..."
    BASE_BRANCH=$("$SCRIPT_DIR/detect-base-branch.sh" "$REPOSITORY_PATH")
    if [ $? -ne 0 ]; then
        echo "Error: Could not detect base branch"
        exit 1
    fi
    echo "Detected base branch: $BASE_BRANCH"
fi

# Step 3: Extract task info from workspace directory name for branch naming
WORKSPACE_NAME=$(basename "$WORKING_DIR")
# Parse workspace name: {task-type}-{ticket-id}-{description}-{date} or {task-type}-{description}-{date}
# Extract task type (first segment)
TASK_TYPE=$(echo "$WORKSPACE_NAME" | cut -d'-' -f1)
# Extract date (last segment, 8 digits)
DATE=$(echo "$WORKSPACE_NAME" | grep -oE '[0-9]{8}$' || echo "$(date +%Y%m%d)")

# Check if there's a ticket ID (second segment starts with uppercase letters followed by dash and numbers)
SECOND_SEGMENT=$(echo "$WORKSPACE_NAME" | cut -d'-' -f2)
if [[ "$SECOND_SEGMENT" =~ ^[A-Z]+-[0-9]+$ ]] || [[ "$SECOND_SEGMENT" =~ ^[A-Z]+[0-9]+$ ]]; then
    TICKET_ID="$SECOND_SEGMENT"
    # Description is everything between ticket ID and date
    DESCRIPTION=$(echo "$WORKSPACE_NAME" | sed "s/^${TASK_TYPE}-${TICKET_ID}-//" | sed "s/-${DATE}$//")
else
    TICKET_ID=""
    # Description is everything between task type and date
    DESCRIPTION=$(echo "$WORKSPACE_NAME" | sed "s/^${TASK_TYPE}-//" | sed "s/-${DATE}$//")
fi

# Step 4: Create git worktree with new branch
echo "==> Creating git worktree..."
cd "$REPOSITORY_PATH"

# Create new branch name based on task info
# Include alias in branch name if present (to avoid collision when same repo is used multiple times)
if [ -n "$TICKET_ID" ]; then
    if [ -n "$REPO_ALIAS" ]; then
        NEW_BRANCH="${TASK_TYPE}/${TICKET_ID}-${DESCRIPTION}-${REPO_ALIAS}"
    else
        NEW_BRANCH="${TASK_TYPE}/${TICKET_ID}-${DESCRIPTION}"
    fi
else
    if [ -n "$REPO_ALIAS" ]; then
        NEW_BRANCH="${TASK_TYPE}/${DESCRIPTION}-${REPO_ALIAS}"
    else
        NEW_BRANCH="${TASK_TYPE}/${DESCRIPTION}-${DATE}"
    fi
fi

# Create worktree with a new branch based on the base branch
# Preserve the org/repo structure in the workspace
WORKTREE_PATH="$WORKING_DIR/$REPOSITORY_PATH_INPUT"
mkdir -p "$(dirname "$WORKTREE_PATH")"
git worktree add -b "$NEW_BRANCH" "$WORKTREE_PATH" "origin/$BASE_BRANCH"
echo "Worktree created: $WORKTREE_PATH"
echo "New branch: $NEW_BRANCH (based on origin/$BASE_BRANCH)"

echo ""
echo "==> Repository setup complete!"
echo "Repository: $REPOSITORY_PATH_INPUT"
echo "Worktree: $WORKTREE_PATH"
echo "Branch: $NEW_BRANCH (based on origin/$BASE_BRANCH)"
