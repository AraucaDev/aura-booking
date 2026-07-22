import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Instancia singleton de Stripe (server-side). */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
  }
  return _stripe;
}

/** Mapea la frecuencia recurrente a un intervalo de suscripción de Stripe. */
export function frequencyToStripeInterval(
  frequency: "monthly" | "biweekly" | "weekly"
): { interval: "week" | "month"; interval_count: number } {
  switch (frequency) {
    case "weekly":
      return { interval: "week", interval_count: 1 };
    case "biweekly":
      return { interval: "week", interval_count: 2 };
    case "monthly":
      return { interval: "month", interval_count: 1 };
  }
}
