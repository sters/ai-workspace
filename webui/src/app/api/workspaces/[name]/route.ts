import { NextResponse } from "next/server";
import { getWorkspaceDetail } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const detail = await getWorkspaceDetail(name);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
