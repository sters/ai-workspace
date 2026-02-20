import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { days } = body as { days?: number };
  const d = days && days > 0 ? days : 7;

  const prompt = `/workspace-prune ${d}`;
  const operation = startOperation("workspace-prune", "(global)", prompt);
  return NextResponse.json(operation);
}
