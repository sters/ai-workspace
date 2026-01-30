#!/bin/bash
# Prepare review directory for workspace
# Usage: prepare-review-dir.sh <workspace-name>
# Output: Path to the created review directory

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

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REVIEW_DIR="${WORKSPACE_DIR}/reviews/${TIMESTAMP}"

mkdir -p "$REVIEW_DIR"

echo "$REVIEW_DIR"
