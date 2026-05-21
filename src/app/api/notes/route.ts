import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setListingNote, getListingNote } from "@/lib/db";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ note: null });
  const note = await getListingNote(user.id, listingId);
  return NextResponse.json({ note });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const { listingId, note } = await req.json() as { listingId: string; note: string };
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  await setListingNote(user.id, listingId, note ?? "");
  return NextResponse.json({ ok: true });
}
