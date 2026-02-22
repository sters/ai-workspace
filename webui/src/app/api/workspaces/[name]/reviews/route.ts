import { NextResponse } from "next/server";
import { getReviewSessions } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const reviews = getReviewSessions(name);
  return NextResponse.json(reviews);
}
