"use client";

import { MarkdownRenderer } from "./markdown-renderer";

export function ReadmeViewer({ content }: { content: string }) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground">No README found.</p>
    );
  }

  return <MarkdownRenderer content={content} />;
}
