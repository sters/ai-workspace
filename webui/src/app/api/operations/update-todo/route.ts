import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace, instruction } = body as {
    workspace: string;
    instruction: string;
  };
  if (!workspace || !instruction) {
    return NextResponse.json(
      { error: "workspace and instruction are required" },
      { status: 400 }
    );
  }

  const prompt = `/workspace-update-todo ${workspace} ${instruction}`;
  const operation = startOperation("update-todo", workspace, prompt);
  return NextResponse.json(operation);
}
