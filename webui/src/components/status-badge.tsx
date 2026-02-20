import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  feature: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bugfix: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  research:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  investigation:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  running:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function StatusBadge({
  label,
  variant,
  className,
}: {
  label: string;
  variant?: string;
  className?: string;
}) {
  const v = variant ?? label.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[v] ?? variants.unknown,
        className
      )}
    >
      {label}
    </span>
  );
}
