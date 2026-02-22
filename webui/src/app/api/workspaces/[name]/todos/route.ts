import { NextResponse } from "next/server";
import { getTodos } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const todos = await getTodos(name);
  return NextResponse.json(todos);
}
