/**
 * Prompt template for workspace-collect-reviews agent.
 * Collects review results and generates a summary report.
 */

export interface CollectorInput {
  workspaceName: string;
  reviewTimestamp: string;
  reviewDir: string;
  reviewFiles: string[];
  verifyFiles: string[];
}

export function buildCollectorPrompt(input: CollectorInput): string {
  return `# Task: Collect review results and create summary

## Workspace: ${input.workspaceName}
## Review Timestamp: ${input.reviewTimestamp}
## Review Directory: ${input.reviewDir}

## Review Files

### Code Reviews
${input.reviewFiles.map((f) => `- ${f}`).join("\n") || "(none)"}

### TODO Verifications
${input.verifyFiles.map((f) => `- ${f}`).join("\n") || "(none)"}

## Summary Report Template

Write the summary to: ${input.reviewDir}/SUMMARY.md

${SUMMARY_REPORT_TEMPLATE}

## Instructions

${COLLECTOR_INSTRUCTIONS}
`;
}

const COLLECTOR_INSTRUCTIONS = `You are a specialized agent for collecting review results and generating a summary report.

**Your mission: Read all review files, extract statistics, and create SUMMARY.md.**

### Execution Steps

1. **Read Each Review File**:
   - Code Reviews: Extract repository name, assessment, critical/warning/suggestion counts
   - TODO Verifications: Extract verified/unverified/partial/incomplete counts

2. **Aggregate Statistics**:
   - Total critical issues, warnings, suggestions across all repos
   - Total verified, unverified, incomplete items
   - Average completion rate

3. **Create Summary Report** at the specified path

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### Guidelines

- If a file can't be parsed, note it in "Failed Reviews"
- Extract counts from patterns like "Critical Issues: X"
- Prioritize critical issues in top priority list
- Use relative paths in SUMMARY.md for markdown links
`;

const SUMMARY_REPORT_TEMPLATE = `# Workspace Review Summary

**Workspace**: {workspace-name}
**Review Date**: {timestamp}
**Repositories Reviewed**: {count}

## Overview

{Brief overview}

## Summary by Repository

### {Repository Name}

- **Review File**: [{filename}](./{filename})
- **Overall Assessment**: {assessment}
- **Critical Issues**: {count}
- **Warnings**: {count}
- **Suggestions**: {count}

## Aggregate Statistics

- **Total Critical Issues**: {sum}
- **Total Warnings**: {sum}
- **Total Suggestions**: {sum}

## Top Priority Issues

## Overall Recommendations

## Conclusion
`;
