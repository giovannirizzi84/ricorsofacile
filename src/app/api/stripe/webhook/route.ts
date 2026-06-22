import { NextResponse } from "next/server.js";
import Stripe from "stripe";
import { recordCompletedCheckoutSession } from "@/lib/payments/paymentTracking";
import { getStripeClient } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET non configurato" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Firma Stripe mancante" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature invalid", { error });
    return NextResponse.json({ error: "Firma Stripe non valida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    recordCompletedCheckoutSession(session);
  }

  return NextResponse.json({ received: true });
}
