import { google } from "googleapis";
import { OPERATING_TZ } from "./utils";

/**
 * Cliente de Google Calendar autenticado con una cuenta de servicio.
 * Requiere que el calendario (GOOGLE_CALENDAR_ID) haya sido compartido con
 * GOOGLE_SERVICE_ACCOUNT_EMAIL con permiso "Hacer cambios en eventos".
 */
function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID || "primary";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startISO: string; // ISO local con offset
  endISO: string;
  location?: string;
  attendees?: string[];
}

/** Crea un evento y devuelve su id. */
export async function createCalendarEvent(input: CalendarEventInput): Promise<string | null> {
  try {
    const calendar = getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: CALENDAR_ID(),
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.startISO, timeZone: OPERATING_TZ },
        end: { dateTime: input.endISO, timeZone: OPERATING_TZ },
        attendees: input.attendees?.map((email) => ({ email })),
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[google-calendar] createCalendarEvent error:", err);
    return null;
  }
}

/** Actualiza fecha/hora de un evento existente (reagendamiento). */
export async function updateCalendarEvent(
  eventId: string,
  startISO: string,
  endISO: string
): Promise<boolean> {
  try {
    const calendar = getCalendarClient();
    await calendar.events.patch({
      calendarId: CALENDAR_ID(),
      eventId,
      requestBody: {
        start: { dateTime: startISO, timeZone: OPERATING_TZ },
        end: { dateTime: endISO, timeZone: OPERATING_TZ },
      },
    });
    return true;
  } catch (err) {
    console.error("[google-calendar] updateCalendarEvent error:", err);
    return false;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId: CALENDAR_ID(), eventId });
    return true;
  } catch (err) {
    console.error("[google-calendar] deleteCalendarEvent error:", err);
    return false;
  }
}

/** Devuelve los eventos (busy) de un día para calcular disponibilidad. */
export async function listBusyIntervals(
  dayStartISO: string,
  dayEndISO: string
): Promise<{ start: string; end: string }[]> {
  try {
    const calendar = getCalendarClient();
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStartISO,
        timeMax: dayEndISO,
        timeZone: OPERATING_TZ,
        items: [{ id: CALENDAR_ID() }],
      },
    });
    const busy = res.data.calendars?.[CALENDAR_ID()]?.busy ?? [];
    return busy.map((b) => ({ start: b.start!, end: b.end! }));
  } catch (err) {
    console.error("[google-calendar] listBusyIntervals error:", err);
    return [];
  }
}
