import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { toStripeAmount } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ bookingId: z.string().uuid() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bookingId inválido" }, { status: 400 });

  const supabase = createAdminClient();
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, quotes(*), clients(*)")
    .eq("id", parsed.data.bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  const quote = (booking as any).quotes;
  const client = (booking as any).clients;
  const amount40 = Number(booking.payment_40_amount || 0);

  // Reutilizar o crear cliente de Stripe.
  let customerId: string;
  const found = await stripe.customers.list({ email: client.email, limit: 1 });
  customerId = found.data[0]?.id ?? (await stripe.customers.create({
    email: client.email,
    name: client.name,
    phone: client.phone || undefined,
    metadata: { client_id: client.id },
  })).id;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_intent_data: {
      // Guardar la tarjeta para cobrar el 60% al completar el servicio.
      setup_future_usage: "off_session",
      metadata: { booking_id: booking.id, kind: "deposit_40" },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: toStripeAmount(amount40),
          product_data: {
            name: "Aura Cleaners — Depósito 40%",
            description: `Reserva ${booking.service_date} ${booking.service_time}`,
          },
        },
      },
    ],
    metadata: {
      booking_id: booking.id,
      quote_id: quote?.id ?? "",
      frequency: quote?.frequency ?? "one_time",
    },
    success_url: `${appUrl}/confirmation/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/book/${quote?.id ?? booking.id}`,
    locale: client.language === "fr" ? "fr" : client.language === "es" ? "es" : "en",
  });

  return NextResponse.json({ url: session.url });
}
