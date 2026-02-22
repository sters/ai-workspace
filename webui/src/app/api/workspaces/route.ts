import { NextResponse } from "next/server";
import { listWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export function GET() {
  const workspaces = listWorkspaces();
  return NextResponse.json(workspaces);
}
