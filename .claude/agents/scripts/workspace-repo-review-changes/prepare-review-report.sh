#!/bin/bash
# Prepare review report from template
# Usage: prepare-review-report.sh <workspace-name> <timestamp> <repository-path>
# Output: Path to the created review file

set -e

WORKSPACE_NAME="$1"
TIMESTAMP="$2"
REPO_PATH="$3"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$TIMESTAMP" ] || [ -z "$REPO_PATH" ]; then
    echo "Error: Workspace name, timestamp, and repository path are required" >&2
    echo "Usage: $0 <workspace-name> <timestamp> <repository-path>" >&2
    exit 1
fi

REVIEW_DIR="workspace/${WORKSPACE_NAME}/reviews/${TIMESTAMP}"

if [ ! -d "$REVIEW_DIR" ]; then
    echo "Error: Review directory not found: $REVIEW_DIR" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../../templates/workspace-repo-review-changes/review-report.md"

# Convert slashes to underscores for filename
FILENAME=$(echo "$REPO_PATH" | tr '/' '_')
REVIEW_FILE="${REVIEW_DIR}/${FILENAME}.md"

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Template not found: $TEMPLATE" >&2
    exit 1
fi

cp "$TEMPLATE" "$REVIEW_FILE"

echo "$REVIEW_FILE"
