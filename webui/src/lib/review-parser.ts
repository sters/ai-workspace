import type { ReviewSession } from "@/types/workspace";

export function parseReviewSummary(
  timestamp: string,
  content: string
): ReviewSession {
  const reposMatch = content.match(/\*\*Repositories Reviewed\*\*:\s*(\d+)/);
  const criticalMatch = content.match(/\*\*Total Critical Issues\*\*:\s*(\d+)/);
  const warningsMatch = content.match(/\*\*Total Warnings\*\*:\s*(\d+)/);
  const suggestionsMatch = content.match(
    /\*\*Total Suggestions\*\*:\s*(\d+)/
  );

  return {
    timestamp,
    repos: parseInt(reposMatch?.[1] ?? "0", 10),
    critical: parseInt(criticalMatch?.[1] ?? "0", 10),
    warnings: parseInt(warningsMatch?.[1] ?? "0", 10),
    suggestions: parseInt(suggestionsMatch?.[1] ?? "0", 10),
  };
}
