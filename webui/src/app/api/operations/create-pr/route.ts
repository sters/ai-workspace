import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace } = body as { workspace: string };
  if (!workspace) {
    return NextResponse.json(
      { error: "workspace is required" },
      { status: 400 }
    );
  }

  const prompt = `/workspace-create-or-update-pr ${workspace}`;
  const operation = startOperation("create-pr", workspace, prompt);
  return NextResponse.json(operation);
}
