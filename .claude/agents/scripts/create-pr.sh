#!/bin/bash
# Create a pull request
# Usage: create-pr.sh <repo-path> <title> <body-file> [--no-draft]
# Output: PR URL

set -e

REPO_PATH="$1"
TITLE="$2"
BODY_FILE="$3"
NO_DRAFT="$4"

if [ -z "$REPO_PATH" ] || [ -z "$TITLE" ] || [ -z "$BODY_FILE" ]; then
    echo "Error: Repository path, title, and body file are required" >&2
    echo "Usage: $0 <repo-path> <title> <body-file> [--no-draft]" >&2
    exit 1
fi

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Repository path not found: $REPO_PATH" >&2
    exit 1
fi

if [ ! -f "$BODY_FILE" ]; then
    echo "Error: Body file not found: $BODY_FILE" >&2
    exit 1
fi

cd "$REPO_PATH"

# Push current branch if needed
CURRENT_BRANCH=$(git branch --show-current)
if ! git ls-remote --exit-code --heads origin "$CURRENT_BRANCH" >/dev/null 2>&1; then
    echo "Pushing branch to remote..." >&2
    git push -u origin "$CURRENT_BRANCH"
fi

# Build gh pr create command
DRAFT_FLAG="--draft"
if [ "$NO_DRAFT" = "--no-draft" ]; then
    DRAFT_FLAG=""
fi

# Create PR
gh pr create $DRAFT_FLAG --title "$TITLE" --body-file "$BODY_FILE"
