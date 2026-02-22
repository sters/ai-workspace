import { NextResponse } from "next/server";
import { getReviewDetail } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string; timestamp: string }> }
) {
  const { name, timestamp } = await params;
  const detail = await getReviewDetail(name, timestamp);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
