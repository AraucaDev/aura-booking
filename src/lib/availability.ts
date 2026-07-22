import { fromZonedTime } from "date-fns-tz";
import { listBusyIntervals } from "./google-calendar";
import { createAdminClient } from "./supabase/admin";
import { BUSINESS_HOURS, OPEN_DAYS, OPERATING_TZ, generateDaySlots } from "./utils";

/** Construye un datetime "naive" local (sin offset) para eventos de Calendar. */
export function localDateTime(dateStr: string, timeStr: string): string {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${t}`;
}

/** Convierte fecha+hora local (America/Toronto) a un instante UTC (Date). */
export function zonedToUtc(dateStr: string, timeStr: string): Date {
  return fromZonedTime(localDateTime(dateStr, timeStr), OPERATING_TZ);
}

/** Suma horas a un "HH:mm" y devuelve "HH:mm" (redondeo a 15 min hacia arriba). */
export function addHoursToTime(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMin = h * 60 + m + Math.ceil(hours * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
}

/**
 * Calcula los slots disponibles para una fecha (YYYY-MM-DD), considerando:
 *  - Horario operativo (Lun–Sáb, 9–18)
 *  - Duración estimada del servicio (para no ofrecer slots que se pasen de las 18h)
 *  - Reservas existentes en Supabase
 *  - Eventos "busy" del Google Calendar
 */
export async function getAvailableSlots(
  dateStr: string,
  durationHours: number
): Promise<SlotAvailability[]> {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  if (!OPEN_DAYS.includes(dow)) {
    return generateDaySlots().map((time) => ({ time, available: false }));
  }

  const dur = Math.max(1, Math.ceil(durationHours || 1));

  // Ventana del día en UTC para freebusy.
  const dayStart = zonedToUtc(dateStr, "00:00").toISOString();
  const dayEnd = zonedToUtc(dateStr, "23:59").toISOString();

  const [busy, existing] = await Promise.all([
    listBusyIntervals(dayStart, dayEnd),
    fetchBookingsForDate(dateStr),
  ]);

  const busyRanges = [
    ...busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
    ...existing.map((b) => ({
      start: zonedToUtc(dateStr, b.service_time.slice(0, 5)),
      end: zonedToUtc(dateStr, addHoursToTime(b.service_time.slice(0, 5), b.duration_hours || 1)),
    })),
  ];

  const dayLength = BUSINESS_HOURS.endHour - BUSINESS_HOURS.startHour;
  const fitsInDay = dur <= dayLength;

  return generateDaySlots().map((time) => {
    const [h] = time.split(":").map(Number);
    // Trabajos normales: deben terminar dentro del horario operativo.
    // Trabajos más grandes que la jornada: se ofrece solo la apertura (best-effort).
    const withinDay = fitsInDay
      ? h + dur <= BUSINESS_HOURS.endHour
      : h === BUSINESS_HOURS.startHour;
    if (!withinDay) return { time, available: false };

    const slotStart = zonedToUtc(dateStr, time);
    const slotEnd = zonedToUtc(dateStr, addHoursToTime(time, dur));
    const overlaps = busyRanges.some(
      (r) => slotStart < r.end && slotEnd > r.start
    );
    return { time, available: !overlaps };
  });
}

async function fetchBookingsForDate(
  dateStr: string
): Promise<{ service_time: string; duration_hours: number }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("service_time, duration_hours")
    .eq("service_date", dateStr)
    .in("status", ["confirmed", "in_progress", "pending_payment"]);
  return data ?? [];
}
