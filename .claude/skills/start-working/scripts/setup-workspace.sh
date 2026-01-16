#!/bin/bash

set -e

# Usage: ./setup-workspace.sh <task-type> <description> <org/repo-name> [base-branch] [ticket-id]
# Example: ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace
# Example: ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace main
# Example: ./setup-workspace.sh feature user-auth github.com/sters/complex-ai-workspace main PROJ-123

TASK_TYPE="$1"
DESCRIPTION="$2"
REPOSITORY_PATH_INPUT="$3"
BASE_BRANCH="$4"
TICKET_ID="$5"

if [ -z "$TASK_TYPE" ] || [ -z "$DESCRIPTION" ] || [ -z "$REPOSITORY_PATH_INPUT" ]; then
    echo "Usage: $0 <task-type> <description> <org/repo-name> [base-branch] [ticket-id]"
    echo "Example: $0 feature user-auth github.com/sters/complex-ai-workspace"
    echo "Example: $0 feature user-auth github.com/sters/complex-ai-workspace main"
    echo "Example: $0 feature user-auth github.com/sters/complex-ai-workspace main PROJ-123"
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
    echo "==> Repository not found. Please provide repository URL to clone:"
    read -r REPO_URL
    if [ -z "$REPO_URL" ]; then
        echo "Error: Repository URL is required"
        exit 1
    fi
    # Create parent directory structure
    mkdir -p "$(dirname "$REPOSITORY_PATH")"
    git clone "$REPO_URL" "$REPOSITORY_PATH"
else
    echo "==> Updating repository..."
    cd "$REPOSITORY_PATH"
    git fetch --all --prune
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

# Step 4: Create README.md
echo "==> Creating README.md..."
cat > "$WORKING_DIR/README.md" << EOF
# Task: ${DESCRIPTION}

## Overview

**Task Type**: ${TASK_TYPE}
**Ticket ID**: ${TICKET_ID:-N/A}
**Date**: $(date +%Y-%m-%d)
**Target Repository**: ${REPOSITORY_NAME}
**Base Branch**: ${BASE_BRANCH}

## Objective

<!-- Describe what needs to be accomplished -->

## Context

<!-- Background information and why this task is needed -->

## Requirements

<!-- Specific requirements and acceptance criteria -->

## Related Resources

<!-- Links to issues, documentation, etc. -->
EOF
echo "Created: $WORKING_DIR/README.md"

# Step 5: Create TODO-<repository-name>.md based on task type
TODO_FILE="$WORKING_DIR/TODO-${REPOSITORY_NAME}.md"
echo "==> Creating TODO-${REPOSITORY_NAME}.md..."
case "$TASK_TYPE" in
    feature|implementation)
        cat > "$TODO_FILE" << EOF
# TODO: ${REPOSITORY_NAME}

## Implementation Tasks

- [ ] Create feature/fix branch from base branch
- [ ] Implement code changes
- [ ] Write/update unit tests
- [ ] Run tests locally and verify all pass
- [ ] Run linter and fix any issues
- [ ] Update documentation if needed
- [ ] Review past commit messages with \`git log\` for reference
- [ ] Commit changes with descriptive message following repository conventions
- [ ] Push branch to remote
- [ ] Address review comments

## Notes

<!-- Add any notes, blockers, or additional tasks here -->
EOF
        ;;
    research)
        cat > "$TODO_FILE" << EOF
# TODO: ${REPOSITORY_NAME}

## Research Tasks

- [ ] Define research questions
- [ ] Identify information sources
- [ ] Conduct research and document findings
- [ ] Summarize conclusions and recommendations
- [ ] Review and validate results

**Note**: Branch creation, commits, and pushes are typically NOT needed for research tasks.

## Notes

<!-- Add any notes, blockers, or additional tasks here -->
EOF
        ;;
    bugfix|bug)
        cat > "$TODO_FILE" << EOF
# TODO: ${REPOSITORY_NAME}

## Bug Fix Tasks

- [ ] Reproduce the bug locally
- [ ] Create bugfix branch from base branch
- [ ] Identify root cause
- [ ] Implement fix
- [ ] Add regression test
- [ ] Verify bug is fixed
- [ ] Run all related tests
- [ ] Run linter
- [ ] Review past commit messages with \`git log\` for reference
- [ ] Commit changes with descriptive message following repository conventions
- [ ] Push branch to remote
- [ ] Address review comments

## Notes

<!-- Add any notes, blockers, or additional tasks here -->
EOF
        ;;
    *)
        cat > "$TODO_FILE" << EOF
# TODO: ${REPOSITORY_NAME}

## Tasks

- [ ] Define task requirements
- [ ] Create implementation plan
- [ ] Execute work
- [ ] Verify completion

## Notes

<!-- Add any notes, blockers, or additional tasks here -->
EOF
        ;;
esac
echo "Created: $TODO_FILE"

echo ""
echo "==> Setup complete!"
echo "Working directory: $WORKING_DIR"
echo "Repository worktree: $WORKTREE_PATH"
echo ""
echo "Next steps:"
echo "1. Update README.md with task details"
echo "2. Review and customize TODO-${REPOSITORY_NAME}.md"
echo "3. Start working through the TODO items"
