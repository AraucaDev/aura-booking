import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { toStripeAmount } from "@/lib/pricing";
import { remainingPaidEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/resend";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ bookingId: z.string().uuid() });

export async function POST(req: Request) {
  // Solo admins autenticados.
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bookingId inválido" }, { status: 400 });

  const supabase = createAdminClient();
  const stripe = getStripe();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, quotes(*), clients(*)")
    .eq("id", parsed.data.bookingId)
    .single();
  if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  if (booking.payment_60_status === "paid") {
    return NextResponse.json({ error: "El 60% ya fue cobrado" }, { status: 409 });
  }
  if (!booking.payment_40_intent_id) {
    return NextResponse.json({ error: "Falta el pago del 40% (sin método guardado)" }, { status: 400 });
  }

  const client = (booking as any).clients;
  const quote = (booking as any).quotes;

  // Recuperar customer + método de pago del depósito.
  const deposit = await stripe.paymentIntents.retrieve(booking.payment_40_intent_id);
  const customerId = deposit.customer as string;
  const paymentMethodId = deposit.payment_method as string;
  if (!customerId || !paymentMethodId) {
    return NextResponse.json({ error: "No hay método de pago guardado" }, { status: 400 });
  }

  const amount60 = Number(booking.payment_60_amount || 0);

  await supabase.from("bookings").update({ payment_60_status: "processing" }).eq("id", booking.id);

  try {
    const pi = await stripe.paymentIntents.create({
      amount: toStripeAmount(amount60),
      currency: "cad",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { booking_id: booking.id, kind: "remaining_60" },
      description: "Aura Cleaners — Saldo 60%",
    });

    await supabase
      .from("bookings")
      .update({
        payment_60_status: pi.status === "succeeded" ? "paid" : "processing",
        payment_60_intent_id: pi.id,
        status: pi.status === "succeeded" ? "completed" : booking.status,
      })
      .eq("id", booking.id);

    if (pi.status === "succeeded" && client?.email) {
      const mail = remainingPaidEmail({
        lang: (client.language ?? "en") as Lang,
        clientName: client.name,
        serviceName: quote?.service_type ?? "",
        date: booking.service_date,
        time: booking.service_time.slice(0, 5),
        address: booking.address ?? "",
        total: Number(quote?.total ?? 0),
        paid40: Number(booking.payment_40_amount ?? 0),
        due60: amount60,
        manageUrl: "",
      });
      await sendEmail({ to: client.email, subject: mail.subject, html: mail.html });
    }

    return NextResponse.json({ status: pi.status });
  } catch (err: any) {
    await supabase.from("bookings").update({ payment_60_status: "failed" }).eq("id", booking.id);
    return NextResponse.json({ error: err.message || "Cobro fallido" }, { status: 402 });
  }
}
