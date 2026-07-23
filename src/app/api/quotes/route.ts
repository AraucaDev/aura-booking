import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLine, computeQuote } from "@/lib/pricing";
import { adminNotificationEmail } from "@/lib/email-templates";
import { assertSlotAvailable } from "@/lib/availability";
import { sendEmail, ADMIN_EMAIL } from "@/lib/resend";
import type { ServiceItem, ServiceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const lineSchema = z.object({ code: z.string(), qty: z.number().int().min(0) });

const bodySchema = z.object({
  lang: z.enum(["en", "fr", "es"]),
  cleanerId: z.number().int().positive(),
  residenceType: z.enum(["residential", "comercial", "airbnb"]),
  serviceType: z.enum(["standard", "deep", "move_in_out", "general", "addons"]),
  roomKey: z.string(),
  roomsFactor: z.number(),
  isFirstService: z.boolean(),
  frequency: z.enum(["one_time", "monthly", "biweekly", "weekly"]),
  services: z.array(lineSchema),
  addons: z.array(lineSchema),
  client: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().default(""),
    address: z.string().min(1),
  }),
  date: z.string(),
  time: z.string(),
});

const APPLY_ROOMS: ServiceType[] = ["standard", "deep", "move_in_out"];

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const supabase = createAdminClient();

  // 0) Validar el cleaner y tomar su tarifa (autoridad de precios).
  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("id, name, hourly_rate, status")
    .eq("id", b.cleanerId)
    .maybeSingle();
  if (!cleaner || cleaner.status !== "active") {
    return NextResponse.json({ error: "El profesional seleccionado no está disponible" }, { status: 400 });
  }
  const hourlyRate = Number(cleaner.hourly_rate ?? 35);

  // 1) Recalcular precios con el catálogo real (autoridad de precios).
  const codes = [...b.services, ...b.addons].map((l) => l.code);
  const { data: catalog } = await supabase.from("services").select("*").in("code", codes);
  const byCode = new Map<string, ServiceItem>((catalog ?? []).map((s: any) => [s.code, s]));

  const applyRooms = APPLY_ROOMS.includes(b.serviceType);
  const serviceLines = b.services
    .filter((l) => l.qty > 0 && byCode.has(l.code))
    .map((l) => buildLine(byCode.get(l.code)!, l.qty, b.roomsFactor, applyRooms, hourlyRate));
  const addonLines = b.addons
    .filter((l) => l.qty > 0 && byCode.has(l.code))
    .map((l) => buildLine(byCode.get(l.code)!, l.qty, b.roomsFactor, false, hourlyRate));

  const breakdown = computeQuote({
    residenceType: b.residenceType,
    serviceType: b.serviceType,
    roomsFactor: b.roomsFactor,
    isFirstService: b.isFirstService,
    frequency: b.frequency,
    services: serviceLines,
    addons: addonLines,
  });

  // 2) Upsert del cliente por email.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", b.client.email)
    .maybeSingle();

  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data: created, error: cErr } = await supabase
      .from("clients")
      .insert({
        name: b.client.name,
        email: b.client.email,
        phone: b.client.phone,
        address: b.client.address,
        language: b.lang,
      })
      .select("id")
      .single();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    clientId = created.id;
  } else {
    await supabase
      .from("clients")
      .update({ name: b.client.name, phone: b.client.phone, address: b.client.address, language: b.lang })
      .eq("id", clientId);
  }

  // 3) Crear la cotización.
  const isRequestQuote = breakdown.hasRequestQuote;
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .insert({
      client_id: clientId,
      cleaner_id: b.cleanerId,
      residence_type: b.residenceType,
      service_type: b.serviceType,
      rooms_factor: b.roomsFactor,
      is_first_service: b.isFirstService,
      frequency: b.frequency,
      services_json: serviceLines,
      addons_json: addonLines,
      subtotal: breakdown.subtotal,
      discount_amount: breakdown.discountAmount,
      total: breakdown.total,
      status: isRequestQuote ? "request_quote" : "pending",
      language: b.lang,
    })
    .select("id")
    .single();
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // 4) Si requiere cotización manual, notificar admin y terminar.
  if (isRequestQuote) {
    const mail = adminNotificationEmail({
      title: "Nueva solicitud de cotización manual",
      lines: [
        { label: "Cliente", value: `${b.client.name} (${b.client.email})` },
        { label: "Servicio", value: b.serviceType },
        { label: "Dirección", value: b.client.address },
        { label: "Quote ID", value: quote.id },
      ],
    });
    await sendEmail({ to: ADMIN_EMAIL(), subject: mail.subject, html: mail.html });
    return NextResponse.json({ quoteId: quote.id, requestQuote: true });
  }

  // 5) Revalidar el horario contra la agenda real del cleaner.
  // La UI pudo quedar desactualizada; esta es la barrera contra dobles reservas.
  const slotCheck = await assertSlotAvailable(
    b.date,
    b.time,
    breakdown.durationHours,
    b.cleanerId
  );
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error, slotTaken: true }, { status: 409 });
  }

  // 6) Crear la reserva (pendiente de pago).
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .insert({
      quote_id: quote.id,
      client_id: clientId,
      cleaner_id: b.cleanerId,
      service_date: b.date,
      service_time: b.time,
      duration_hours: breakdown.durationHours,
      address: b.client.address,
      status: "pending_payment",
      payment_40_amount: breakdown.payment40,
      payment_60_amount: breakdown.payment60,
    })
    .select("id")
    .single();
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  return NextResponse.json({ quoteId: quote.id, bookingId: booking.id, requestQuote: false });
}
