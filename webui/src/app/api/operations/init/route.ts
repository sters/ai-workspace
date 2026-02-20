import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { description } = body as { description: string };
  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  const prompt = `/workspace-init ${description}`;
  const operation = startOperation("init", description, prompt);
  return NextResponse.json(operation);
}
