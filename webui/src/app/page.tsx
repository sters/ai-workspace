import Link from "next/link";
import { WorkspaceList } from "@/components/dashboard/workspace-list";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <Link
          href="/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Workspace
        </Link>
      </div>

      <WorkspaceList />
    </div>
  );
}
