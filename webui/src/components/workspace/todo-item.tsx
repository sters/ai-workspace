import { cn } from "@/lib/utils";
import type { TodoItem as TodoItemType } from "@/types/workspace";
import { MarkdownRenderer } from "../shared/markdown-renderer";

const statusIcons: Record<TodoItemType["status"], string> = {
  completed: "\u2705",
  pending: "\u2B1C",
  blocked: "\u26D4",
  in_progress: "\u23F3",
};

const statusStyles: Record<TodoItemType["status"], string> = {
  completed: "text-muted-foreground line-through",
  pending: "",
  blocked: "text-red-600 dark:text-red-400",
  in_progress: "text-amber-600 dark:text-amber-400",
};

export function TodoItemRow({ item }: { item: TodoItemType }) {
  return (
    <div>
      <div
        className={cn("flex items-start gap-2 py-1", statusStyles[item.status])}
        style={{ paddingLeft: `${item.indent * 0.75 + 0.5}rem` }}
      >
        <span className="flex-shrink-0 text-sm">{statusIcons[item.status]}</span>
        <span className="text-sm">{item.text}</span>
      </div>
      {item.children.length > 0 && (
        <div
          className="border-l-2 border-muted pb-1 text-xs text-muted-foreground [&_.prose]:text-xs [&_.prose]:text-muted-foreground"
          style={{ marginLeft: `${item.indent * 0.75 + 1.5}rem`, paddingLeft: "0.75rem" }}
        >
          <MarkdownRenderer content={item.children.join("\n")} />
        </div>
      )}
    </div>
  );
}
