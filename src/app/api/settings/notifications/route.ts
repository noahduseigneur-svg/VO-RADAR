import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateNotificationPrefs } from "@/lib/db";

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  await updateNotificationPrefs(user.id, {
    digest_enabled: body.digest_enabled,
    notif_price_drop: body.notif_price_drop,
    notif_listing_gone: body.notif_listing_gone,
  });
  return NextResponse.json({ ok: true });
}
