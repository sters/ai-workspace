import { NextResponse } from "next/server";
import { listStaleWorkspaces, deleteWorkspace } from "@/lib/workspace-ops";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { days } = body as { days?: number };
  const d = days && days > 0 ? days : 7;

  const stale = listStaleWorkspaces(d);
  const deleted: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const workspace of stale) {
    try {
      deleteWorkspace(workspace.name);
      deleted.push(workspace.name);
    } catch (err) {
      failed.push({
        name: workspace.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ success: true, days: d, deleted, failed });
}
