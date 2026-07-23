import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerSupabase } from "@/lib/supabase/server";
import { OPERATING_TZ } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de la conexión con Google Calendar.
 * Solo accesible con sesión de admin. No expone secretos: de la private key
 * solo reporta forma y longitud, nunca su contenido.
 *
 * Uso: inicia sesión en /dashboard y abre /api/diagnostics/calendar
 */
export async function GET() {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "";
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  const checks: Record<string, unknown> = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email || "❌ FALTA",
    GOOGLE_CALENDAR_ID: calendarId || "❌ FALTA",
    private_key: {
      presente: rawKey.length > 0,
      longitud: rawKey.length,
      empieza_correcto: rawKey.includes("BEGIN PRIVATE KEY"),
      termina_correcto: rawKey.includes("END PRIVATE KEY"),
      tiene_barra_n_literal: rawKey.includes("\\n"),
      tiene_saltos_reales: rawKey.includes("\n"),
      entre_comillas: rawKey.startsWith('"') || rawKey.startsWith("'"),
    },
    timezone: OPERATING_TZ,
  };

  if (!email || !calendarId || !rawKey) {
    return NextResponse.json(
      { ok: false, paso: "variables", checks, sugerencia: "Falta al menos una variable en Vercel. Guárdala y haz Redeploy." },
      { status: 200 }
    );
  }

  // Normaliza la key igual que lo hace la app.
  const key = rawKey.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");

  let calendar;
  try {
    const jwt = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    await jwt.authorize(); // falla aquí si la key es inválida
    calendar = google.calendar({ version: "v3", auth: jwt });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      paso: "autenticacion",
      checks,
      error: err?.message || String(err),
      sugerencia:
        "La private key no es válida. Vuelve a copiarla del JSON incluyendo los \\n, sin las comillas de los extremos.",
    });
  }

  // ¿Tiene acceso al calendario?
  try {
    await calendar.events.list({ calendarId, maxResults: 1 });
  } catch (err: any) {
    const code = err?.code || err?.response?.status;
    return NextResponse.json({
      ok: false,
      paso: "acceso_al_calendario",
      checks,
      codigo: code,
      error: err?.message || String(err),
      sugerencia:
        code === 404
          ? `El calendario "${calendarId}" no existe o la cuenta de servicio no lo ve. Verifica que GOOGLE_CALENDAR_ID sea exactamente el email dueño del calendario.`
          : code === 403
          ? `Falta compartir el calendario con ${email} con permiso "Hacer cambios en eventos", o la Google Calendar API no está habilitada en el proyecto de Google Cloud.`
          : "Revisa el error de arriba.",
    });
  }

  // ¿Puede escribir? Crea un evento de prueba y lo borra.
  let testEventId: string | null = null;
  try {
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    const startISO = start.toISOString().slice(0, 19);
    const endISO = new Date(start.getTime() + 3600 * 1000).toISOString().slice(0, 19);
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: "✅ Aura — evento de prueba (se borra solo)",
        start: { dateTime: startISO, timeZone: OPERATING_TZ },
        end: { dateTime: endISO, timeZone: OPERATING_TZ },
      },
    });
    testEventId = res.data.id ?? null;
    if (testEventId) await calendar.events.delete({ calendarId, eventId: testEventId });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      paso: "escritura",
      checks,
      codigo: err?.code || err?.response?.status,
      error: err?.message || String(err),
      sugerencia: `La cuenta de servicio puede leer pero no escribir. En Google Calendar comparte el calendario con ${email} usando "Hacer cambios en eventos" (no solo "Ver todos los detalles").`,
    });
  }

  return NextResponse.json({
    ok: true,
    mensaje: "✅ Google Calendar funciona: autenticación, lectura y escritura correctas.",
    checks,
  });
}
