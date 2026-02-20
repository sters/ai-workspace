import type { TodoItem, TodoFile, TodoSection } from "@/types/workspace";

const STATUS_PATTERNS: [RegExp, TodoItem["status"]][] = [
  [/^(\s*)- \[x\]\s+(.*)/, "completed"],
  [/^(\s*)- \[ \]\s+(.*)/, "pending"],
  [/^(\s*)- \[!\]\s+(.*)/, "blocked"],
  [/^(\s*)- \[~\]\s+(.*)/, "in_progress"],
];

export function parseTodoItems(content: string): TodoItem[] {
  const items: TodoItem[] = [];
  for (const line of content.split("\n")) {
    let matched = false;
    for (const [pattern, status] of STATUS_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        items.push({
          text: match[2].trim(),
          status,
          indent: match[1].length,
          children: [],
        });
        matched = true;
        break;
      }
    }
    if (!matched && items.length > 0) {
      // Indented non-checkbox line → child of the last item
      const indentMatch = line.match(/^(\s+)/);
      if (indentMatch && indentMatch[1].length > items[items.length - 1].indent) {
        const trimmed = line.trim();
        if (trimmed) {
          items[items.length - 1].children.push(trimmed);
        }
      }
    }
  }
  return items;
}

export function parseTodoSections(content: string): TodoSection[] {
  const sections: TodoSection[] = [];
  let current: TodoSection | null = null;
  let lastItem: TodoItem | null = null;

  for (const line of content.split("\n")) {
    // Skip the top-level title (# TODO: ...)
    if (/^# /.test(line)) continue;

    // Section heading (## ...)
    const headingMatch = line.match(/^## (.+)/);
    if (headingMatch) {
      if (current && (current.items.length > 0 || current.notes.length > 0)) {
        sections.push(current);
      }
      current = { heading: headingMatch[1].trim(), items: [], notes: [] };
      lastItem = null;
      continue;
    }

    if (!current) {
      current = { heading: "", items: [], notes: [] };
    }

    // Try checkbox item
    let matched = false;
    for (const [pattern, status] of STATUS_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const item: TodoItem = {
          text: match[2].trim(),
          status,
          indent: match[1].length,
          children: [],
        };
        current.items.push(item);
        lastItem = item;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Non-checkbox, non-empty text
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Indented line after a checkbox item → child of that item
    const indentMatch = line.match(/^(\s+)/);
    if (lastItem && indentMatch && indentMatch[1].length > lastItem.indent) {
      lastItem.children.push(trimmed);
    } else {
      // Non-indented or no preceding item → section note
      current.notes.push(trimmed);
      lastItem = null;
    }
  }

  if (current && (current.items.length > 0 || current.notes.length > 0)) {
    sections.push(current);
  }

  return sections;
}

export function parseTodoFile(
  filename: string,
  content: string
): TodoFile {
  const items = parseTodoItems(content);
  const sections = parseTodoSections(content);
  const completed = items.filter((i) => i.status === "completed").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const blocked = items.filter((i) => i.status === "blocked").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed * 100) / total) : 0;

  // Extract repo name from filename: TODO-{repo}.md -> {repo}
  const repoName = filename.replace(/^TODO-/, "").replace(/\.md$/, "");

  return {
    filename,
    repoName,
    items,
    sections,
    completed,
    pending,
    blocked,
    inProgress,
    total,
    progress,
  };
}
