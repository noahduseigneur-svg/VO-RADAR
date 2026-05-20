import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await logout();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
