import { NextResponse } from "next/server";
import { killOperation } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { operationId } = body as { operationId: string };

  if (!operationId) {
    return NextResponse.json(
      { error: "operationId is required" },
      { status: 400 }
    );
  }

  const ok = killOperation(operationId);
  if (!ok) {
    return NextResponse.json(
      { error: "Operation not found or not running" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
