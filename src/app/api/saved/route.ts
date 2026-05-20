import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { toggleSavedListing } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { listing_id?: string; note?: string };
  if (!body.listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });
  const saved = await toggleSavedListing(user.id, body.listing_id, body.note ?? null);
  return NextResponse.json({ saved });
}
