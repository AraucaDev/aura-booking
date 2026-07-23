import { fromZonedTime } from "date-fns-tz";
import { createAdminClient } from "./supabase/admin";
import { BUSINESS_HOURS, OPEN_DAYS, OPERATING_TZ } from "./utils";

/** Margen obligatorio entre dos servicios de un mismo cleaner (traslado). */
export const TRAVEL_BUFFER_MINUTES = 60;

/** Estados de reserva que ocupan agenda. */
const BLOCKING_STATUSES = ["pending_payment", "confirmed", "in_progress"];

/** Construye un datetime "naive" local (sin offset) para eventos de Calendar. */
export function localDateTime(dateStr: string, timeStr: string): string {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${t}`;
}

/** Convierte fecha+hora local (America/Toronto) a un instante UTC (Date). */
export function zonedToUtc(dateStr: string, timeStr: string): Date {
  return fromZonedTime(localDateTime(dateStr, timeStr), OPERATING_TZ);
}

/** Suma horas a un "HH:mm" y devuelve "HH:mm". */
export function addHoursToTime(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMin = h * 60 + m + Math.ceil(hours * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:mm[:ss]" → minutos desde medianoche. */
function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
  /** Motivo cuando no está disponible (útil para la UI y depuración). */
  reason?: "outside_schedule" | "booked" | "buffer" | "too_long";
}

export interface BusyInterval {
  startMin: number;
  endMin: number;
}

/**
 * Reservas que ocupan la agenda de un cleaner en una fecha.
 * Si `excludeBookingId` se pasa, esa reserva se ignora (útil al reagendar).
 */
export async function getCleanerBusyIntervals(
  dateStr: string,
  cleanerId: number,
  excludeBookingId?: string
): Promise<BusyInterval[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bookings")
    .select("id, service_time, duration_hours")
    .eq("service_date", dateStr)
    .eq("cleaner_id", cleanerId)
    .in("status", BLOCKING_STATUSES);

  if (excludeBookingId) query = query.neq("id", excludeBookingId);

  const { data } = await query;
  return (data ?? []).map((b: any) => {
    const startMin = toMinutes(String(b.service_time));
    return {
      startMin,
      endMin: startMin + Math.ceil(Number(b.duration_hours || 1) * 60),
    };
  });
}

/** Ventana de trabajo del cleaner ese día. null = no trabaja. */
async function getCleanerWindow(
  dateStr: string,
  cleanerId: number
): Promise<{ startMin: number; endMin: number } | null> {
  const supabase = createAdminClient();
  const weekday = weekdayOf(dateStr);

  const { data } = await supabase
    .from("cleaner_availability")
    .select("start_time, end_time, active")
    .eq("cleaner_id", cleanerId)
    .eq("weekday", weekday)
    .maybeSingle();

  // Sin registro para ese día → se usa el horario general de la empresa.
  if (!data) {
    if (!OPEN_DAYS.includes(weekday)) return null;
    return { startMin: BUSINESS_HOURS.startHour * 60, endMin: BUSINESS_HOURS.endHour * 60 };
  }
  if (!data.active) return null;
  return { startMin: toMinutes(String(data.start_time)), endMin: toMinutes(String(data.end_time)) };
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Verifica si un intervalo [startMin, endMin) choca con alguna reserva,
 * respetando el margen de traslado a ambos lados.
 */
export function hasConflict(
  startMin: number,
  endMin: number,
  busy: BusyInterval[],
  bufferMin = TRAVEL_BUFFER_MINUTES
): boolean {
  return busy.some(
    (b) => startMin < b.endMin + bufferMin && endMin > b.startMin - bufferMin
  );
}

/**
 * Slots disponibles para un cleaner en una fecha.
 * Considera: su horario semanal, sus reservas existentes y 1h de margen entre
 * servicios. Cada cleaner tiene su propia agenda: las reservas de uno no
 * bloquean a los demás.
 */
export async function getAvailableSlots(
  dateStr: string,
  durationHours: number,
  cleanerId: number,
  excludeBookingId?: string
): Promise<SlotAvailability[]> {
  const durMin = Math.max(60, Math.ceil((durationHours || 1) * 60));

  const window = await getCleanerWindow(dateStr, cleanerId);
  // El cleaner no trabaja ese día: rejilla completa deshabilitada.
  if (!window) {
    return buildGrid().map((min) => ({
      time: minutesToLabel(min),
      available: false,
      reason: "outside_schedule" as const,
    }));
  }

  const busy = await getCleanerBusyIntervals(dateStr, cleanerId, excludeBookingId);

  const windowLength = window.endMin - window.startMin;
  const fitsInDay = durMin <= windowLength;

  return buildGrid(window).map((min) => {
    const time = minutesToLabel(min);
    const endMin = min + durMin;

    // Dentro del horario del cleaner.
    if (min < window.startMin) {
      return { time, available: false, reason: "outside_schedule" as const };
    }
    if (fitsInDay) {
      if (endMin > window.endMin) {
        return { time, available: false, reason: "too_long" as const };
      }
    } else if (min !== window.startMin) {
      // Servicio más largo que la jornada: solo se ofrece la hora de apertura.
      return { time, available: false, reason: "too_long" as const };
    }

    if (hasConflict(min, endMin, busy)) {
      return { time, available: false, reason: "booked" as const };
    }
    return { time, available: true };
  });
}

/** Rejilla horaria mostrada en la UI (por hora). */
function buildGrid(window?: { startMin: number; endMin: number }): number[] {
  const start = Math.min(window?.startMin ?? BUSINESS_HOURS.startHour * 60, BUSINESS_HOURS.startHour * 60);
  const end = Math.max(window?.endMin ?? BUSINESS_HOURS.endHour * 60, BUSINESS_HOURS.endHour * 60);
  const slots: number[] = [];
  for (let m = start; m < end; m += 60) slots.push(m);
  return slots;
}

/**
 * Validación server-side antes de crear/mover una reserva.
 * Es la barrera real contra dobles reservas (la UI puede estar desactualizada).
 */
export async function assertSlotAvailable(
  dateStr: string,
  time: string,
  durationHours: number,
  cleanerId: number,
  excludeBookingId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const window = await getCleanerWindow(dateStr, cleanerId);
  if (!window) return { ok: false, error: "El profesional no trabaja ese día." };

  const startMin = toMinutes(time);
  const durMin = Math.max(60, Math.ceil((durationHours || 1) * 60));
  const endMin = startMin + durMin;

  if (startMin < window.startMin) {
    return { ok: false, error: "El horario está fuera de la jornada del profesional." };
  }
  const windowLength = window.endMin - window.startMin;
  if (durMin <= windowLength && endMin > window.endMin) {
    return { ok: false, error: "El servicio no termina dentro de la jornada del profesional." };
  }

  const busy = await getCleanerBusyIntervals(dateStr, cleanerId, excludeBookingId);
  if (hasConflict(startMin, endMin, busy)) {
    return {
      ok: false,
      error:
        "Ese horario ya no está disponible: el profesional tiene otro servicio (se requiere 1 hora de margen entre servicios).",
    };
  }
  return { ok: true };
}
