import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, frequencyToStripeInterval } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent } from "@/lib/google-calendar";
import { localDateTime, addHoursToTime } from "@/lib/availability";
import { toStripeAmount } from "@/lib/pricing";
import { clientConfirmationEmail, adminNotificationEmail } from "@/lib/email-templates";
import { sendEmail, ADMIN_EMAIL } from "@/lib/resend";
import type { Frequency, Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[webhook] firma inválida:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        // Cargar reserva + cotización + cliente.
        const { data: booking } = await supabase
          .from("bookings")
          .select("*, quotes(*), clients(*), cleaners(name)")
          .eq("id", bookingId)
          .single();
        if (!booking) break;
        const quote = (booking as any).quotes;
        const client = (booking as any).clients;
        const cleanerName = (booking as any).cleaners?.name ?? "Sin asignar";

        // Crear evento de Google Calendar.
        const startISO = localDateTime(booking.service_date, booking.service_time.slice(0, 5));
        const endISO = localDateTime(
          booking.service_date,
          addHoursToTime(booking.service_time.slice(0, 5), booking.duration_hours || 1)
        );
        const eventId = await createCalendarEvent({
          summary: `Aura — ${client?.name ?? "Cliente"} · ${cleanerName} (${quote?.service_type ?? ""})`,
          description:
            `Reserva ${bookingId}\n` +
            `Cliente: ${client?.name} · ${client?.phone ?? ""}\n` +
            `Profesional: ${cleanerName}\n` +
            `Total: ${quote?.total} CAD`,
          startISO,
          endISO,
          location: booking.address ?? undefined,
        });

        // Actualizar reserva a confirmada.
        await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            payment_40_status: "paid",
            payment_40_intent_id: paymentIntentId,
            google_calendar_event_id: eventId,
          })
          .eq("id", bookingId);

        // Suscripción recurrente si aplica.
        const frequency = (session.metadata?.frequency || "one_time") as Frequency;
        if (frequency !== "one_time" && session.customer) {
          await createRecurringSubscription({
            stripe,
            supabase,
            customerId: session.customer as string,
            paymentIntentId,
            bookingId,
            clientId: client?.id,
            frequency,
            total: Number(quote?.total ?? 0),
            serviceDate: booking.service_date,
            clientName: client?.name ?? "Aura",
          });
        }

        // Emails.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const lang = (client?.language ?? "en") as Lang;
        const cMail = clientConfirmationEmail({
          lang,
          clientName: client?.name ?? "",
          serviceName: quote?.service_type ?? "",
          date: booking.service_date,
          time: booking.service_time.slice(0, 5),
          address: booking.address ?? "",
          total: Number(quote?.total ?? 0),
          paid40: Number(booking.payment_40_amount ?? 0),
          due60: Number(booking.payment_60_amount ?? 0),
          manageUrl: `${appUrl}/reschedule/${bookingId}`,
        });
        if (client?.email) await sendEmail({ to: client.email, subject: cMail.subject, html: cMail.html });

        const aMail = adminNotificationEmail({
          title: "Nueva reserva confirmada",
          lines: [
            { label: "Cliente", value: `${client?.name} (${client?.email})` },
            { label: "Fecha", value: `${booking.service_date} ${booking.service_time.slice(0, 5)}` },
            { label: "Servicio", value: quote?.service_type ?? "" },
            { label: "Total", value: `${quote?.total} CAD` },
          ],
        });
        await sendEmail({ to: ADMIN_EMAIL(), subject: aMail.subject, html: aMail.html });
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.kind === "remaining_60" && pi.metadata?.booking_id) {
          await supabase
            .from("bookings")
            .update({ payment_60_status: "paid", status: "completed", payment_60_intent_id: pi.id })
            .eq("id", pi.metadata.booking_id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.kind === "remaining_60" && pi.metadata?.booking_id) {
          await supabase
            .from("bookings")
            .update({ payment_60_status: "failed" })
            .eq("id", pi.metadata.booking_id);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[webhook] error procesando evento:", err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function createRecurringSubscription(opts: {
  stripe: Stripe;
  supabase: ReturnType<typeof createAdminClient>;
  customerId: string;
  paymentIntentId: string | null;
  bookingId: string;
  clientId?: string;
  frequency: Exclude<Frequency, "one_time">;
  total: number;
  serviceDate: string;
  clientName: string;
}) {
  const { stripe, supabase, customerId, paymentIntentId, frequency, total } = opts;
  try {
    // Recuperar el método de pago guardado en el depósito.
    let paymentMethodId: string | undefined;
    if (paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentMethodId = (pi.payment_method as string) || undefined;
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }).catch(() => {});
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }
    }

    const nextDate = computeNextDate(opts.serviceDate, frequency);
    const interval = frequencyToStripeInterval(frequency);

    // Las suscripciones requieren un Product; lo creamos al vuelo.
    const product = await stripe.products.create({
      name: `Aura Cleaners — Limpieza ${frequency}`,
    });

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: "cad",
            product: product.id,
            unit_amount: toStripeAmount(total),
            recurring: interval,
          },
        },
      ],
      // No cobrar ahora; primer cargo en la próxima visita.
      trial_end: Math.floor(new Date(`${nextDate}T09:00:00`).getTime() / 1000),
      default_payment_method: paymentMethodId,
      metadata: { booking_id: opts.bookingId },
    });

    await supabase.from("subscriptions").insert({
      booking_id: opts.bookingId,
      client_id: opts.clientId,
      stripe_subscription_id: sub.id,
      frequency,
      next_date: nextDate,
      status: "active",
    });
  } catch (err) {
    console.error("[webhook] error creando suscripción:", err);
  }
}

function computeNextDate(dateStr: string, frequency: Exclude<Frequency, "one_time">): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "weekly") dt.setUTCDate(dt.getUTCDate() + 7);
  else if (frequency === "biweekly") dt.setUTCDate(dt.getUTCDate() + 14);
  else dt.setUTCMonth(dt.getUTCMonth() + 1);
  return dt.toISOString().slice(0, 10);
}
