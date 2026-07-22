# Configurar Google Calendar con cuenta de servicio

El sistema crea, actualiza y consulta eventos en un calendario de Google usando
una **cuenta de servicio** (service account). No se necesita OAuth de usuario.

Calendario de prueba: **grondon@araucagroup.com**

---

## Paso 1 — Crear un proyecto en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/).
2. Arriba, **Select a project → New Project**. Nómbralo `aura-booking`.

## Paso 2 — Habilitar la Google Calendar API

1. Menú → **APIs & Services → Library**.
2. Busca **Google Calendar API** → **Enable**.

## Paso 3 — Crear la cuenta de servicio

1. **APIs & Services → Credentials → Create Credentials → Service account**.
2. Nombre: `aura-calendar`. Click **Create and continue**.
3. Rol: puedes dejarlo sin rol (los permisos se otorgan compartiendo el
   calendario). **Done**.
4. Copia el **email** de la cuenta de servicio, del tipo:
   `aura-calendar@aura-booking.iam.gserviceaccount.com`
   → va en `GOOGLE_SERVICE_ACCOUNT_EMAIL`.

## Paso 4 — Generar la clave privada (JSON)

1. Abre la cuenta de servicio → pestaña **Keys → Add key → Create new key**.
2. Tipo **JSON** → **Create**. Se descarga un archivo `.json`.
3. Del JSON necesitas dos campos:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key`  → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

> **Importante — saltos de línea.** La `private_key` del JSON contiene `\n`.
> En `.env.local` pégala **entre comillas** y en una sola línea; el código ya
> reemplaza `\n` por saltos reales:
>
> ```env
> GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
> ```
>
> En **Vercel**, pega el valor con los `\n` literales tal cual (Vercel los
> conserva) o usa comillas igual que arriba.

## Paso 5 — Compartir el calendario con la cuenta de servicio

La cuenta de servicio **no** ve tu calendario hasta que lo compartas:

1. En [Google Calendar](https://calendar.google.com/) con la cuenta
   `grondon@araucagroup.com`, ve a **Settings** del calendario que usarás.
2. **Share with specific people → Add people**.
3. Pega el email de la cuenta de servicio
   (`aura-calendar@…iam.gserviceaccount.com`).
4. Permiso: **Make changes to events** (Hacer cambios en eventos).
5. Guarda.

## Paso 6 — Obtener el Calendar ID

- En **Settings → Integrate calendar → Calendar ID**.
- Para el calendario principal de una cuenta suele ser el email:
  `grondon@araucagroup.com` → va en `GOOGLE_CALENDAR_ID`.

## Paso 7 — Variables finales

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=aura-calendar@aura-booking.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=grondon@araucagroup.com
```

## Cómo se usa en el código

- [`src/lib/google-calendar.ts`](../src/lib/google-calendar.ts)
  - `createCalendarEvent` — al confirmarse el pago (webhook de Stripe).
  - `updateCalendarEvent` — al reagendar.
  - `listBusyIntervals` (freebusy) — para calcular slots disponibles.
- La disponibilidad combina: horario operativo (Lun–Sáb 9–18), duración
  estimada del servicio, reservas en Supabase y eventos "busy" del calendario
  ([`src/lib/availability.ts`](../src/lib/availability.ts)).

## Solución de problemas

| Síntoma | Causa probable |
|---------|----------------|
| `403 forbidden` al crear evento | No compartiste el calendario con la cuenta de servicio, o sin permiso "Make changes". |
| `invalid_grant` / firma inválida | La `private_key` perdió los `\n`. Revísala entre comillas. |
| Eventos en hora incorrecta | Verifica `OPERATING_TIMEZONE=America/Toronto`. |
| No aparecen slots ocupados | El `GOOGLE_CALENDAR_ID` no coincide con el calendario compartido. |
