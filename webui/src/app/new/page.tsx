"use client";

import { useState } from "react";
import { ClaudeOperation } from "@/components/shared/claude-operation";

const TASK_TYPES = ["feature", "bugfix", "research", "investigation"] as const;

export default function NewWorkspacePage() {
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<string>("feature");
  const [ticketId, setTicketId] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [repos, setRepos] = useState<string[]>([]);

  const addRepo = () => {
    const trimmed = repoInput.trim();
    if (!trimmed || repos.includes(trimmed)) return;
    setRepos([...repos, trimmed]);
    setRepoInput("");
  };

  const removeRepo = (index: number) => {
    setRepos(repos.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">New Workspace</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Initialize a new workspace from a task description.
      </p>

      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Ticket ID <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g., PROJ-123"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">
            Task Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Add retry logic to the payment service"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            rows={4}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Repositories</label>
          <div className="flex gap-2">
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRepo();
                }
              }}
              placeholder="e.g., github.com/org/repo"
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={addRepo}
              disabled={!repoInput.trim()}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {repos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {repos.map((repo, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs"
                >
                  {repo}
                  <button
                    type="button"
                    onClick={() => removeRepo(i)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClaudeOperation storageKey="init">
        {({ start, isRunning }) =>
          !isRunning ? (
            <button
              onClick={() => {
                if (!description.trim()) return;
                const body: Record<string, string> = {
                  description: description.trim(),
                  taskType,
                };
                if (ticketId.trim()) {
                  body.ticketId = ticketId.trim();
                }
                if (repos.length > 0) {
                  body.repositories = JSON.stringify(repos);
                }
                start("init", body);
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
