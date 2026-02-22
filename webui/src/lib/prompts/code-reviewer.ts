/**
 * Prompt template for workspace-repo-review-changes agent.
 * Reviews code changes in a repository.
 */

export interface CodeReviewerInput {
  workspaceName: string;
  repoPath: string;
  repoName: string;
  baseBranch: string;
  reviewTimestamp: string;
  readmeContent: string;
  worktreePath: string;
  repoChanges: string;
  reviewFilePath: string;
}

export function buildCodeReviewerPrompt(input: CodeReviewerInput): string {
  return `# Task: Review code changes for ${input.repoName}

## Workspace: ${input.workspaceName}
## Repository: ${input.repoPath}
## Base Branch: ${input.baseBranch}
## Review Timestamp: ${input.reviewTimestamp}
## Worktree: ${input.worktreePath}

## Workspace README

${input.readmeContent}

## Repository Changes

${input.repoChanges}

## Review Report Template

Write the review report to: ${input.reviewFilePath}

Use this template structure:

${REVIEW_REPORT_TEMPLATE}

## Instructions

${CODE_REVIEWER_INSTRUCTIONS}
`;
}

const CODE_REVIEWER_INSTRUCTIONS = `You are a specialized agent for reviewing code changes in a repository. Your role is to analyze differences between the current branch and the base branch, then provide a thorough code review.

**Your mission: Review all code changes and write a comprehensive review report.**

### Execution Steps

1. **Understand Overall Changes**:
   - Review the changed files list from the changes above
   - Categorize changes by type (new features, bug fixes, refactoring, etc.)

2. **Analyze Each Change**:
   - Read each modified/new file content
   - Read related files for context
   - Check for: logic errors, security vulnerabilities, performance issues, style inconsistencies, missing error handling, input validation, resource management, concurrency issues

3. **Categorize Findings**:
   - **Critical Issues** (must fix): security vulnerabilities, logic errors, data loss risks
   - **Warnings** (should address): performance concerns, missing error handling
   - **Suggestions** (nice-to-have): code organization, naming, test coverage
   - **Positive Feedback**: well-structured code, good patterns

4. **Write Review Report** to the specified file path

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### Technical Checks

**All Languages**: Error handling, no hardcoded secrets, input validation, resource cleanup, consistent style
**Go**: Proper error handling, context usage, no goroutine leaks, proper defer
**TypeScript/JavaScript**: Proper types, async/await correctness, proper React hooks
**Python**: Proper exception handling, type hints, context managers

### Guidelines

- Be constructive: explain *why* something is an issue
- Be thorough: read full context
- Be specific: reference exact line numbers
- Consider context: understand task requirements
`;

const REVIEW_REPORT_TEMPLATE = `# Code Review: {repository_name}

**Task**: {task_name}
**Repository**: {repository_path}
**Base Branch**: {base_branch}
**Review Date**: {timestamp}

## Summary

{Brief overview of changes}

## Changed Files

{List of changed files}

## Detailed Review

### {File Path}

**Change Type**: Added/Modified/Deleted
**Summary**: {What changed}

#### Critical Issues
- {Issue description}

#### Warnings
- {Warning description}

#### Suggestions
- {Suggestion}

#### Positive Feedback
- {Good practice}

## Overall Assessment

**Code Quality**: {Rating}
**Test Coverage**: {Assessment}
**Security**: {Assessment}

## Recommendations

1. {Recommendation}

## Conclusion

{Final assessment}
`;
