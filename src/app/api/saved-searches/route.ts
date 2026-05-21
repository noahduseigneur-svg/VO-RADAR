import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSavedSearches, upsertSavedSearch, deleteSavedSearch } from "@/lib/db";
import { newId } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  const searches = await getSavedSearches(user.id);
  return NextResponse.json(searches);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const { name, params } = await req.json() as { name: string; params: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const id = newId("ss_");
  await upsertSavedSearch(user.id, id, name.trim(), params);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteSavedSearch(user.id, id);
  return NextResponse.json({ ok: true });
}
