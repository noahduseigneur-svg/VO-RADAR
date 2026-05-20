import { NextResponse } from "next/server";
import { sendDailyDigests } from "@/lib/digest";
import { updateUserDigestPref } from "@/lib/db";
import { currentUser } from "@/lib/auth";

// GET /api/digest — appelé par Vercel Cron (Authorization: Bearer CRON_SECRET)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendDailyDigests(24);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[digest]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// POST /api/digest — envoi manuel depuis les settings (pas de secret requis, session user)
export async function POST(req: Request) {
  // Compatibilité ancienne API : accept aussi x-digest-secret pour les tests directs
  const secret = process.env.DIGEST_SECRET;
  if (secret) {
    const auth = req.headers.get("x-digest-secret");
    if (auth !== secret) {
      // Essayer aussi le format Bearer
      const bearer = req.headers.get("authorization");
      if (bearer !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
  }

  const body = await req.json().catch(() => ({})) as { hours?: number };
  const hours = Number(body.hours ?? 24);

  try {
    const result = await sendDailyDigests(hours);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[digest]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PATCH /api/digest — toggle opt-in/out pour l'utilisateur connecté
export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled required" }, { status: 400 });
  }

  await updateUserDigestPref(user.id, body.enabled);
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
