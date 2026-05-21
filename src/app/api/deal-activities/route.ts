import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addDealActivity, getDealActivities, deleteDealActivity, type DealActivityType } from "@/lib/db";

// GET /api/deal-activities?listing_id=xxx
export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id requis" }, { status: 400 });
  const activities = await getDealActivities(user.id, listingId);
  return NextResponse.json(activities);
}

// POST /api/deal-activities
export async function POST(req: Request) {
  const user = await requireUser();
  const { listing_id, type, content, metadata } = await req.json();
  if (!listing_id || !type || !content?.trim()) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }
  const VALID_TYPES: DealActivityType[] = ["call", "offer", "visit", "note", "status_change"];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }
  await addDealActivity(user.id, listing_id, type as DealActivityType, content.trim(), metadata);
  return NextResponse.json({ ok: true });
}

// DELETE /api/deal-activities?id=xxx
export async function DELETE(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await deleteDealActivity(user.id, id);
  return NextResponse.json({ ok: true });
}
