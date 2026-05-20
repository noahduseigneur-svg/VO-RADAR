import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/stripe";
import { updateUserStripe } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "stripe not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id;
      const plan = s.metadata?.plan;
      if (userId) {
        await updateUserStripe(userId, {
          stripe_customer_id: (s.customer as string) ?? null,
          stripe_subscription_id: (s.subscription as string) ?? null,
          subscription_status: "active",
          plan: plan as "solo" | "pro" | "groupe" | undefined,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.user_id as string | undefined) ?? null;
      if (userId) {
        await updateUserStripe(userId, {
          subscription_status: sub.status as "active" | "past_due" | "canceled" | "incomplete",
        });
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
