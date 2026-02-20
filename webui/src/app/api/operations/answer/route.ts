import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { operationId, toolUseId, answers } = body as {
    operationId: string;
    toolUseId: string;
    answers: Record<string, string>;
  };

  if (!operationId || !toolUseId || !answers) {
    return NextResponse.json(
      { error: "operationId, toolUseId, and answers are required" },
      { status: 400 }
    );
  }

  const ok = submitAnswer(operationId, toolUseId, answers);
  if (!ok) {
    return NextResponse.json(
      { error: "Operation not found, not running, or no pending question" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
