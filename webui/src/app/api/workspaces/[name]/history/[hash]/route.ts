import { NextResponse } from "next/server";
import { getCommitDiff } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string; hash: string }> }
) {
  const { name, hash } = await params;
  const diff = getCommitDiff(name, hash);
  if (diff === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ diff });
}
