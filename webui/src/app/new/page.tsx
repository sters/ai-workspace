"use client";

import { useState } from "react";
import { ClaudeOperation } from "@/components/shared/claude-operation";

export default function NewWorkspacePage() {
  const [description, setDescription] = useState("");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">New Workspace</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Describe the task, ticket, or feature. Claude will determine the task
        type, repositories, and workspace name automatically.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium">
          Task Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={"e.g., Add retry logic to the payment service in github.com/org/payment-api\ne.g., https://example.atlassian.net/browse/PROJ-123 を実装する\ne.g., github.com/org/frontend と github.com/org/api に認証機能を追加"}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          rows={6}
          autoFocus
        />
      </div>

      <ClaudeOperation storageKey="init">
        {({ start, isRunning }) =>
          !isRunning ? (
            <button
              onClick={() => {
                if (!description.trim()) return;
                start("init", { description: description.trim() });
              }}
              disabled={!description.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Initialize
            </button>
          ) : null
        }
      </ClaudeOperation>
    </div>
  );
}
