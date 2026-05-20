import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUser } from "@/lib/auth";
import { createCustomSource, deleteCustomSource, listCustomSources, updateCustomSource } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sources: await listCustomSources() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sitemap_url?: string;
    product_url_pattern?: string;
    crawl_delay_ms?: number;
    batch_size?: number;
  };
  if (!body.name || !body.sitemap_url || !body.product_url_pattern) {
    return NextResponse.json({ error: "name, sitemap_url, product_url_pattern requis" }, { status: 400 });
  }

  const slug = body.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = `custom-${slug}-${crypto.randomBytes(3).toString("hex")}`;

  try {
    await createCustomSource({
      id,
      name: body.name.trim().slice(0, 100),
      sitemap_url: body.sitemap_url.trim(),
      product_url_pattern: body.product_url_pattern.trim().slice(0, 500),
      crawl_delay_ms: Math.max(3000, Math.min(60000, body.crawl_delay_ms ?? 5500)),
      batch_size: Math.max(5, Math.min(50, body.batch_size ?? 20)),
      enabled: 1,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 500 });
  }
  return NextResponse.json({ id, ok: true });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; enabled?: boolean };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof body.enabled === "boolean") {
    await updateCustomSource(body.id, { enabled: body.enabled ? 1 : 0 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteCustomSource(id);
  return NextResponse.json({ ok: true });
}
