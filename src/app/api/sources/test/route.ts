import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { probeSitemap } from "@/lib/scrapers/universal";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    sitemap_url?: string; product_url_pattern?: string;
  };
  if (!body.sitemap_url) return NextResponse.json({ error: "sitemap_url required" }, { status: 400 });

  try {
    const u = new URL(body.sitemap_url);
    if (!/^https?:$/.test(u.protocol)) {
      return NextResponse.json({ error: "URL doit être http(s)" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  const result = await probeSitemap({
    sitemap_url: body.sitemap_url,
    product_url_pattern: body.product_url_pattern,
    sample_size: 3,
  });
  return NextResponse.json(result);
}
