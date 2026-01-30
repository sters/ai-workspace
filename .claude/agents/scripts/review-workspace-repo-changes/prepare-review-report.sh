#!/bin/bash
# Prepare review report from template
# Usage: prepare-review-report.sh <review-directory> <repository-path>
# Output: Path to the created review file

set -e

REVIEW_DIR="$1"
REPO_PATH="$2"

if [ -z "$REVIEW_DIR" ] || [ -z "$REPO_PATH" ]; then
    echo "Error: Review directory and repository path are required" >&2
    echo "Usage: $0 <review-directory> <repository-path>" >&2
    exit 1
fi

if [ ! -d "$REVIEW_DIR" ]; then
    echo "Error: Review directory not found: $REVIEW_DIR" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../../templates/review-workspace-repo-changes/review-report.md"

# Convert slashes to underscores for filename
FILENAME=$(echo "$REPO_PATH" | tr '/' '_')
REVIEW_FILE="${REVIEW_DIR}/${FILENAME}.md"

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Template not found: $TEMPLATE" >&2
    exit 1
fi

cp "$TEMPLATE" "$REVIEW_FILE"

echo "$REVIEW_FILE"
