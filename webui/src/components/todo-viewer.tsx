"use client";

import type { TodoFile, TodoSection } from "@/types/workspace";
import { TodoItemRow } from "./todo-item";
import { ProgressBar } from "./progress-bar";
import { MarkdownRenderer } from "./markdown-renderer";

const NOTE_SECTION_RE = /notes/i;

function SectionBlock({ section }: { section: TodoSection }) {
  const isNoteSection =
    NOTE_SECTION_RE.test(section.heading) && section.items.length === 0;

  if (isNoteSection) {
    return (
      <div className="rounded-md bg-blue-50 px-3 py-2 text-xs dark:bg-blue-950/30 [&_.prose]:text-xs [&_.prose]:text-blue-700 [&_.prose_strong]:text-blue-700 dark:[&_.prose]:text-blue-300 dark:[&_.prose_strong]:text-blue-300">
        {section.heading && (
          <p className="mb-1 text-xs font-medium uppercase text-blue-600 dark:text-blue-400">
            {section.heading}
          </p>
        )}
        <MarkdownRenderer content={section.notes.join("\n")} />
      </div>
    );
  }

  return (
    <div>
      {section.heading && (
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
          {section.heading}
        </p>
      )}
      {section.items.length > 0 && (
        <div className="space-y-0.5">
          {section.items.map((item, i) => (
            <TodoItemRow key={i} item={item} />
          ))}
        </div>
      )}
      {section.notes.length > 0 && (
        <div className="mt-1 border-l-2 border-muted pl-3 text-xs text-muted-foreground [&_.prose]:text-xs [&_.prose]:text-muted-foreground">
          <MarkdownRenderer content={section.notes.join("\n")} />
        </div>
      )}
    </div>
  );
}

export function TodoViewer({ todos }: { todos: TodoFile[] }) {
  if (todos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No TODO files found.</p>
    );
  }

  return (
    <div className="space-y-6">
      {todos.map((todo) => (
        <div key={todo.filename} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{todo.repoName}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{todo.completed}/{todo.total} done</span>
              {todo.blocked > 0 && (
                <span className="text-red-500">{todo.blocked} blocked</span>
              )}
              {todo.inProgress > 0 && (
                <span className="text-amber-500">
                  {todo.inProgress} in progress
                </span>
              )}
            </div>
          </div>
          <ProgressBar value={todo.progress} className="mb-3" />
          <div className="space-y-3">
            {todo.sections.length > 0
              ? todo.sections.map((section, i) => (
                  <SectionBlock key={i} section={section} />
                ))
              : todo.items.map((item, i) => (
                  <TodoItemRow key={i} item={item} />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}
