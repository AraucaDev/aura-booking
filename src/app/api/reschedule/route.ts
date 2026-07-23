import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { assertSlotAvailable, localDateTime, addHoursToTime } from "@/lib/availability";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  date: z.string(),
  time: z.string(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { bookingId, date, time } = parsed.data;

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  if (["completed", "cancelled"].includes(booking.status)) {
    return NextResponse.json({ error: "Esta reserva no puede reagendarse" }, { status: 409 });
  }

  if (!booking.cleaner_id) {
    return NextResponse.json(
      { error: "La reserva no tiene profesional asignado" },
      { status: 409 }
    );
  }

  // Validar el nuevo horario contra la agenda del cleaner (excluyendo esta
  // misma reserva, para que no choque consigo misma).
  const check = await assertSlotAvailable(
    date,
    time,
    Number(booking.duration_hours || 1),
    booking.cleaner_id,
    bookingId
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 });

  await supabase.from("bookings").update({ service_date: date, service_time: time }).eq("id", bookingId);

  if (booking.google_calendar_event_id) {
    const startISO = localDateTime(date, time);
    const endISO = localDateTime(date, addHoursToTime(time, booking.duration_hours || 1));
    await updateCalendarEvent(booking.google_calendar_event_id, startISO, endISO);
  }

  return NextResponse.json({ ok: true });
}
