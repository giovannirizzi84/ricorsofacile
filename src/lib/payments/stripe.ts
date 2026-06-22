import Stripe from "stripe";

export const screeningPrice = {
  amount: 99,
  currency: "eur",
  productName: "Screening AI MulteOnline",
  description: "Analisi preliminare automatizzata del verbale",
} as const;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configurata");
  }

  return new Stripe(secretKey, {
    typescript: true,
  });
}

export function getCheckoutOrigin(request: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin;

  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}
