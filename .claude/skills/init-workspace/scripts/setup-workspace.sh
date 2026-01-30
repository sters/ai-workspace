#!/bin/bash

set -e

# Usage: ./setup-workspace.sh <task-type> <description> <org/repo-name> [ticket-id]
# Example: ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace
# Example: ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace PROJ-123
#
# Base branch is auto-detected from remote. To override, set BASE_BRANCH environment variable:
# BASE_BRANCH=develop ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace

TASK_TYPE="$1"
DESCRIPTION="$2"
REPOSITORY_PATH_INPUT="$3"
TICKET_ID="$4"
# BASE_BRANCH can be set via environment variable, otherwise it will be auto-detected

if [ -z "$TASK_TYPE" ] || [ -z "$DESCRIPTION" ] || [ -z "$REPOSITORY_PATH_INPUT" ]; then
    echo "Usage: $0 <task-type> <description> <org/repo-name> [ticket-id]"
    echo "Example: $0 feature user-auth github.com/sters/complex-ai-workspace"
    echo "Example: $0 feature user-auth github.com/sters/complex-ai-workspace PROJ-123"
    echo ""
    echo "Base branch is auto-detected. To override: BASE_BRANCH=develop $0 ..."
    exit 1
fi

# Extract repository name from path (last component)
REPOSITORY_NAME=$(basename "$REPOSITORY_PATH_INPUT")

# Get the script directory and workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
REPOSITORIES_DIR="$WORKSPACE_ROOT/repositories"
WORKSPACE_DIR="$WORKSPACE_ROOT/workspace"

# Create working directory name
DATE=$(date +%Y%m%d)
if [ -n "$TICKET_ID" ]; then
    WORKING_DIR_NAME="${TASK_TYPE}-${TICKET_ID}-${DESCRIPTION}-${DATE}"
else
    WORKING_DIR_NAME="${TASK_TYPE}-${DESCRIPTION}-${DATE}"
fi

WORKING_DIR="$WORKSPACE_DIR/$WORKING_DIR_NAME"
REPOSITORY_PATH="$REPOSITORIES_DIR/$REPOSITORY_PATH_INPUT"

echo "==> Setting up workspace: $WORKING_DIR_NAME"

# Step 1: Create working directory
echo "==> Creating working directory..."
mkdir -p "$WORKING_DIR"
echo "Created: $WORKING_DIR"

# Step 2: Update repository
if [ ! -d "$REPOSITORY_PATH" ]; then
    echo "==> Repository not found. Cloning from $REPOSITORY_PATH_INPUT..."
    # Generate clone URL from repository path (e.g., github.com/org/repo -> https://github.com/org/repo.git)
    REPO_URL="https://${REPOSITORY_PATH_INPUT}.git"
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

# Step 2.5: Detect base branch if not specified
if [ -z "$BASE_BRANCH" ]; then
    echo "==> Detecting base branch..."
    BASE_BRANCH=$("$SCRIPT_DIR/detect-base-branch.sh" "$REPOSITORY_PATH")
    if [ $? -ne 0 ]; then
        echo "Error: Could not detect base branch"
        exit 1
    fi
    echo "Detected base branch: $BASE_BRANCH"
fi

# Step 3: Create git worktree with new branch
echo "==> Creating git worktree..."
cd "$REPOSITORY_PATH"

# Create new branch name based on task info
if [ -n "$TICKET_ID" ]; then
    NEW_BRANCH="${TASK_TYPE}/${TICKET_ID}-${DESCRIPTION}"
else
    NEW_BRANCH="${TASK_TYPE}/${DESCRIPTION}-${DATE}"
fi

# Create worktree with a new branch based on the base branch
# Preserve the org/repo structure in the workspace
WORKTREE_PATH="$WORKING_DIR/$REPOSITORY_PATH_INPUT"
mkdir -p "$(dirname "$WORKTREE_PATH")"
git worktree add -b "$NEW_BRANCH" "$WORKTREE_PATH" "origin/$BASE_BRANCH"
echo "Worktree created: $WORKTREE_PATH"
echo "New branch: $NEW_BRANCH (based on origin/$BASE_BRANCH)"

# Templates directory (one level up from scripts/)
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

# Step 4: Create tmp directory
echo "==> Creating tmp directory..."
mkdir -p "$WORKING_DIR/tmp"
echo "Created: $WORKING_DIR/tmp"

# Step 5: Initialize git repository for workspace tracking
echo "==> Initializing git repository for workspace tracking..."
cd "$WORKING_DIR"
git init --quiet

# Create .gitignore to exclude worktrees and tmp
cat > .gitignore << 'GITIGNORE'
# Exclude repository worktrees (they are separate git repos)
github.com/
gitlab.com/
bitbucket.org/

# Exclude temporary files
tmp/
*.tmp
*.log
GITIGNORE

echo "Git repository initialized with .gitignore"

# Step 6: Create README.md from template
echo "==> Creating README.md..."
sed -e "s/{{DESCRIPTION}}/${DESCRIPTION}/g" \
    -e "s/{{TASK_TYPE}}/${TASK_TYPE}/g" \
    -e "s/{{TICKET_ID}}/${TICKET_ID:-N\/A}/g" \
    -e "s/{{DATE}}/$(date +%Y-%m-%d)/g" \
    -e "s/{{REPOSITORY_NAME}}/${REPOSITORY_NAME}/g" \
    -e "s/{{BASE_BRANCH}}/${BASE_BRANCH}/g" \
    "$TEMPLATES_DIR/README.md" > "$WORKING_DIR/README.md"
echo "Created: $WORKING_DIR/README.md"

# Step 7: Create initial git commit for workspace tracking
# Note: TODO files are created by workspace-repo-todo-planner agent, not by this script
echo "==> Creating initial git commit..."
cd "$WORKING_DIR"
git add .gitignore README.md
git commit --quiet -m "Initial: $WORKING_DIR_NAME workspace created"
echo "Initial commit created"

echo ""
echo "==> Setup complete!"
echo "Working directory: $WORKING_DIR"
echo "Repository worktree: $WORKTREE_PATH"
echo ""
echo "Next steps:"
echo "1. Update README.md with task details"
echo "2. Run workspace-repo-todo-planner to create TODO items"
echo "3. Run workspace-todo-coordinator to optimize for parallel execution"
