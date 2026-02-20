"use client";

import { useState } from "react";
import { ClaudeOperation } from "@/components/claude-operation";

export default function NewWorkspacePage() {
  const [description, setDescription] = useState("");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">New Workspace</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Initialize a new workspace from a task description.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium">
          Task Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., feature add-retry-logic github.com/org/repo"
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
