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

  const prompt = `/workspace-review-changes ${workspace}`;
  const operation = startOperation("review", workspace, prompt);
  return NextResponse.json(operation);
}
