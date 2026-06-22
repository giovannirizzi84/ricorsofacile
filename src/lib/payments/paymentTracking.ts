import type Stripe from "stripe";
import { getStripeClient, screeningPrice } from "./stripe.ts";

export type PaymentTrackingRecord = {
  sessionId: string;
  amount: number;
  currency: string;
  createdAt: string;
  status: string;
  email: string | null;
};

const paymentRecords = new Map<string, PaymentTrackingRecord>();

export function recordCheckoutSession(session: Stripe.Checkout.Session) {
  const record = {
    sessionId: session.id,
    amount: session.amount_total ?? screeningPrice.amount,
    currency: session.currency ?? screeningPrice.currency,
    createdAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000)
      .toISOString(),
    status: session.payment_status ?? "unpaid",
    email: session.customer_details?.email ?? session.customer_email ?? null,
  };
  paymentRecords.set(session.id, record);
  console.info("Stripe checkout session tracked", record);
  return record;
}

export function recordCompletedCheckoutSession(session: Stripe.Checkout.Session) {
  const record = {
    sessionId: session.id,
    amount: session.amount_total ?? screeningPrice.amount,
    currency: session.currency ?? screeningPrice.currency,
    createdAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000)
      .toISOString(),
    status: session.payment_status ?? "paid",
    email: session.customer_details?.email ?? session.customer_email ?? null,
  };
  paymentRecords.set(session.id, record);
  console.info("Stripe checkout session completed", record);
  return record;
}

export async function verifyPaidCheckoutSession(sessionId: string) {
  if (!sessionId || !/^cs_(test|live)_/.test(sessionId)) {
    return {
      valid: false,
      reason: "missing_or_invalid_session_id",
      record: null,
    } as const;
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const record = recordCheckoutSession(session);
    const valid =
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.amount_total === screeningPrice.amount &&
      session.currency === screeningPrice.currency;

    return {
      valid,
      reason: valid ? "paid" : "not_paid_or_amount_mismatch",
      record,
    } as const;
  } catch (error) {
    console.error("Stripe checkout verification failed", {
      sessionId,
      error,
    });
    return {
      valid: false,
      reason: "stripe_verification_failed",
      record: null,
    } as const;
  }
}

export function isPaymentBypassAllowedForTests() {
  return (
    process.env.NODE_ENV === "test" ||
    process.argv.includes("--test") ||
    process.env.OPENAI_API_KEY === "test-openai-key" ||
    process.env.STRIPE_ANALYZE_BYPASS === "test-only"
  );
}
