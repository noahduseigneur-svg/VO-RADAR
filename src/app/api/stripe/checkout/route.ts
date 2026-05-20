import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { PLANS, type PlanKey, stripeClient, stripeEnabled } from "@/lib/stripe";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const plan = String(form.get("plan") ?? "") as PlanKey;
  if (!PLANS[plan]) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  if (!stripeEnabled()) {
    // demo mode: just bounce back with a flag
    const url = new URL("/settings?demo_checkout=1&plan=" + plan, req.url);
    return NextResponse.redirect(url, { status: 303 });
  }

  const stripe = stripeClient()!;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [{ price: PLANS[plan].stripe_price_id, quantity: 1 }],
    success_url: new URL("/settings?checkout=success", req.url).toString(),
    cancel_url: new URL("/settings?checkout=canceled", req.url).toString(),
    metadata: { user_id: user.id, plan },
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
