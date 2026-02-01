#!/bin/bash
# Prepare summary report from template
# Usage: prepare-summary-report.sh <workspace-name> <timestamp>
# Output: Path to the created SUMMARY.md

set -e

WORKSPACE_NAME="$1"
TIMESTAMP="$2"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$TIMESTAMP" ]; then
    echo "Error: Workspace name and timestamp are required" >&2
    echo "Usage: $0 <workspace-name> <timestamp>" >&2
    exit 1
fi

REVIEW_DIR="workspace/${WORKSPACE_NAME}/reviews/${TIMESTAMP}"

if [ ! -d "$REVIEW_DIR" ]; then
    echo "Error: Review directory not found: $REVIEW_DIR" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../../templates/workspace-collect-reviews/summary-report.md"
SUMMARY_FILE="${REVIEW_DIR}/SUMMARY.md"

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Template not found: $TEMPLATE" >&2
    exit 1
fi

cp "$TEMPLATE" "$SUMMARY_FILE"

echo "$SUMMARY_FILE"
