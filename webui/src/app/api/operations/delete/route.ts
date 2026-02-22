import { NextResponse } from "next/server";
import { resolveWorkspaceName } from "@/lib/config";
import { deleteWorkspace } from "@/lib/workspace-ops";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace: rawWorkspace } = body as { workspace: string };
  if (!rawWorkspace) {
    return NextResponse.json(
      { error: "workspace is required" },
      { status: 400 }
    );
  }

  const workspace = resolveWorkspaceName(rawWorkspace);

  try {
    await deleteWorkspace(workspace);
    return NextResponse.json({ success: true, workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
