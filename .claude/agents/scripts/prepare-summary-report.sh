#!/bin/bash
# Prepare summary report from template
# Usage: prepare-summary-report.sh <review-directory>
# Output: Path to the created SUMMARY.md

set -e

REVIEW_DIR="$1"

if [ -z "$REVIEW_DIR" ]; then
    echo "Error: Review directory is required" >&2
    echo "Usage: $0 <review-directory>" >&2
    exit 1
fi

if [ ! -d "$REVIEW_DIR" ]; then
    echo "Error: Review directory not found: $REVIEW_DIR" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../templates/summary-report.md"
SUMMARY_FILE="${REVIEW_DIR}/SUMMARY.md"

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: Template not found: $TEMPLATE" >&2
    exit 1
fi

cp "$TEMPLATE" "$SUMMARY_FILE"

echo "$SUMMARY_FILE"
