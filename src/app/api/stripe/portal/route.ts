import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stripeClient, stripeEnabled } from "@/lib/stripe";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  if (!stripeEnabled() || !user.stripe_customer_id) {
    return NextResponse.redirect(new URL("/settings?portal=unavailable", req.url), { status: 303 });
  }

  const stripe = stripeClient()!;
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: new URL("/settings", req.url).toString(),
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
