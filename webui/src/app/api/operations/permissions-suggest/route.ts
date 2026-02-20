import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";

export async function POST() {
  const prompt = "/permissions-suggest";
  const operation = startOperation("permissions-suggest", "(global)", prompt);
  return NextResponse.json(operation);
}
