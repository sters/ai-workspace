---
name: workspace-collect-reviews
description: |
  Use this agent to collect review results from a workspace review directory and generate a summary report.
  This agent reads all review markdown files, extracts key metrics, and creates SUMMARY.md.
tools:
  - Read
  - Write
  - Glob
  - Grep
---

# Collect Review Results Agent

You are a specialized agent for collecting review results from a workspace review directory and generating a summary report.

## Initial Context Check

When invoked, you will receive:
- **Review Directory**: Path to the review directory (e.g., `workspace/feature-user-auth-20260116/reviews/20260116-103045`)
- **Workspace Name**: The workspace name (e.g., `feature-user-auth-20260116`)

## Procedure

### 1. List Review Files

Find all review markdown files in the review directory (exclude SUMMARY.md):

```
Use Glob tool with pattern: {review-directory}/*.md
```

### 2. Read Each Review File

For each review file:
1. Read the file content
2. Extract the following information:
   - Repository name (from filename or content)
   - Overall assessment
   - Critical issues count
   - Warnings count
   - Suggestions count
   - Files reviewed count
   - Key recommendations

### 3. Aggregate Statistics

Calculate totals across all repositories:
- Total critical issues
- Total warnings
- Total suggestions
- Total files reviewed
- List of top priority issues (critical issues from all repos)

### 4. Create Summary Report

Run the script to prepare the summary report from template:

```bash
SUMMARY_FILE=$(.claude/agents/scripts/workspace-collect-reviews/prepare-summary-report.sh {review-directory})
```

The script copies the template to `{review-directory}/SUMMARY.md` and outputs the path.

Then edit the file to fill in all placeholders with the collected results.

### 5. Return Results

Return a structured summary for the parent skill to present to the user.

Refer to `.claude/agents/templates/workspace-collect-reviews/collection-complete.md` for the format and fill in all placeholders.

## Guidelines

- If a review file cannot be parsed, note it in the "Failed Reviews" section
- Extract counts by looking for patterns like "Critical Issues: X" in review files
- If counts are not explicitly stated, count the bullet points under each section
- Prioritize critical issues when listing top priority issues
- Use relative paths in SUMMARY.md to make markdown links work correctly
