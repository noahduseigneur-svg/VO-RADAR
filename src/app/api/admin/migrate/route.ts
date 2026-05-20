import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/migrations/run";

/**
 * POST /api/admin/migrate
 * Protégé par CRON_SECRET (header Authorization: Bearer <secret>).
 * Applique toutes les migrations SQL présentes dans /src/lib/migrations/*.sql.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runMigrations();
    return NextResponse.json({ ok: true, migrations: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[migrate] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
