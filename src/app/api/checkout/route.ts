import { NextResponse } from "next/server.js";
import { recordCheckoutSession } from "@/lib/payments/paymentTracking";
import {
  getCheckoutOrigin,
  getStripeClient,
  screeningPrice,
} from "@/lib/payments/stripe";

export const runtime = "nodejs";

type CheckoutRequest = {
  documentCount?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CheckoutRequest;
    const origin = getCheckoutOrigin(request);
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: screeningPrice.currency,
            product_data: {
              name: screeningPrice.productName,
              description: screeningPrice.description,
            },
            unit_amount: screeningPrice.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        service: "screening_ai",
        documentCount: String(payload.documentCount ?? 0),
      },
      consent_collection: {
        terms_of_service: "required",
      },
      custom_text: {
        submit: {
          message:
            `Procedendo confermi di richiedere lo Screening AI preliminare MulteOnline. Privacy e termini sono disponibili su ${origin}/privacy e ${origin}/termini.`,
        },
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    });

    recordCheckoutSession(session);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: screeningPrice.amount,
      currency: screeningPrice.currency,
      createdAt: new Date(session.created * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Stripe checkout creation failed", { error });
    return NextResponse.json(
      {
        error:
          "Non è stato possibile avviare il pagamento. Riprova tra poco.",
      },
      { status: 500 },
    );
  }
}
