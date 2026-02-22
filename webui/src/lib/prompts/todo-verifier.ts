/**
 * Prompt template for workspace-repo-todo-verifier agent.
 * Verifies TODO items have been properly completed.
 */

export interface TodoVerifierInput {
  workspaceName: string;
  repoPath: string;
  repoName: string;
  baseBranch: string;
  reviewTimestamp: string;
  todoContent: string;
  worktreePath: string;
  verifyFilePath: string;
}

export function buildTodoVerifierPrompt(input: TodoVerifierInput): string {
  return `# Task: Verify TODO completion for ${input.repoName}

## Workspace: ${input.workspaceName}
## Repository: ${input.repoPath}
## Base Branch: ${input.baseBranch}
## Review Timestamp: ${input.reviewTimestamp}
## Worktree: ${input.worktreePath}

## TODO File (TODO-${input.repoName}.md)

${input.todoContent}

## Verification Report Template

Write the verification report to: ${input.verifyFilePath}

Use this template:

${VERIFICATION_REPORT_TEMPLATE}

## Instructions

${verifierInstructions(input.worktreePath, input.baseBranch)}
`;
}

function verifierInstructions(worktreePath: string, baseBranch: string): string {
  return `You are a specialized agent for verifying that TODO items have been properly completed. Your role is to compare the TODO file against actual code changes and confirm each item was addressed.

**IMPORTANT: Scope Limitation**
- You ONLY verify whether TODO items have been completed (done or not done)
- You do NOT review code quality, design decisions, or implementation details

### Execution Steps

1. **Parse TODO Items** from the TODO file above:
   - Extract checkbox status, target, expected action, verification criteria

2. **Get Changed Files**:
   \`\`\`bash
   git -C ${worktreePath} diff --name-only origin/${baseBranch}...HEAD
   \`\`\`

3. **Verify Each TODO Item**:
   - **Checked items (\`[x]\`)**: Verify target file was modified; mark as VERIFIED, UNVERIFIED, or PARTIAL
   - **Unchecked items (\`[ ]\`)**: Check if work was done anyway; mark as INCOMPLETE, UNMARKED, or SKIPPED

4. **Verification Methods**:
   - File existence / modification checks
   - Content search (Grep for expected patterns)
   - Test file existence checks

5. **Write Verification Report** to the specified file path

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### Guidelines

1. Be thorough but practical
2. Don't block on minor issues
3. Focus on discrepancies: flag items marked done without evidence
4. Stay in scope: only verify completion status, never comment on code quality
`;
}

const VERIFICATION_REPORT_TEMPLATE = `# TODO Verification: {repository_name}

**Task**: {task_name}
**Repository**: {repository_path}
**Base Branch**: {base_branch}
**Verification Date**: {timestamp}

## Summary

| Status | Count |
|--------|-------|
| Verified | {count} |
| Unverified | {count} |
| Partial | {count} |
| Incomplete | {count} |
| Unmarked | {count} |
| Skipped | {count} |

**Completion Rate**: {pct}% ({completed} / {total})

## Verified Items

## Partial Items

## Issues Found

### Unverified (marked done, no evidence)

### Incomplete (not done)

### Unmarked (done but not checked)

## Skipped Items

## Changed Files Reference

## Recommendations
`;
