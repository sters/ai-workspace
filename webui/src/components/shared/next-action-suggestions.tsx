"use client";

import { useRouter, usePathname } from "next/navigation";
import type { OperationType } from "@/types/operation";

interface NextAction {
  label: string;
  type: OperationType;
  body: Record<string, string>;
  primary?: boolean;
}

function getNextActions(
  completedType: OperationType,
  workspace: string
): NextAction[] {
  switch (completedType) {
    case "init":
      return [
        {
          label: "Execute",
          type: "execute",
          body: { workspace },
          primary: true,
        },
      ];
    case "execute":
      return [
        {
          label: "Review Changes",
          type: "review",
          body: { workspace },
          primary: true,
        },
      ];
    case "review":
      return [
        {
          label: "Create PR",
          type: "create-pr",
          body: { workspace },
          primary: true,
        },
        {
          label: "Execute",
          type: "execute",
          body: { workspace },
        },
      ];
    case "update-todo":
      return [
        {
          label: "Execute",
          type: "execute",
          body: { workspace },
          primary: true,
        },
      ];
    case "create-pr":
      // Terminal operation
      return [];
    default:
      return [];
  }
}

/** Actions that should run in the Operations tab (not inline). */
const OPERATIONS_TAB_ACTIONS = new Set<OperationType>([
  "execute",
  "review",
  "create-pr",
]);

export function NextActionSuggestions({
  operationType,
  workspace,
  onStart,
  isRunning,
  useNavigation,
}: {
  operationType: OperationType;
  workspace: string;
  onStart: (type: OperationType, body: Record<string, string>) => Promise<void>;
  isRunning: boolean;
  /** When true, use URL navigation (?action=) instead of calling onStart directly for Operations-tab actions. */
  useNavigation?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const actions = getNextActions(operationType, workspace);

  if (actions.length === 0) return null;

  const handleClick = (action: NextAction) => {
    if (useNavigation && OPERATIONS_TAB_ACTIONS.has(action.type)) {
      // Navigate to the workspace page with ?action= to auto-trigger in Operations tab
      // pathname is already /workspace/[name], just append the query param
      router.push(`${pathname}?action=${action.type}`);
    } else {
      onStart(action.type, action.body);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
      <p className="mb-2 text-sm font-medium text-foreground">Next steps</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.type}
            onClick={() => handleClick(action)}
            disabled={isRunning}
            className={
              action.primary
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                : "rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
