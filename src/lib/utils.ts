import type { Lang } from "./types";

export const OPERATING_TZ = process.env.OPERATING_TIMEZONE || "America/Toronto";

/** Horario operativo: Lun–Sáb, 9:00–18:00 */
export const BUSINESS_HOURS = { startHour: 9, endHour: 18 };
export const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // 0 = domingo

export function formatCAD(amount: number, lang: Lang = "en"): string {
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-CA" : "en-CA";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

/** Genera slots horarios (cada 60 min) dentro del horario operativo. */
export function generateDaySlots(): string[] {
  const slots: string[] = [];
  for (let h = BUSINESS_HOURS.startHour; h < BUSINESS_HOURS.endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

export function isOpenDay(date: Date): boolean {
  return OPEN_DAYS.includes(date.getDay());
}
