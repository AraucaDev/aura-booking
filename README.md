# Aura Cleaners — Cotizador y Reservas

Sistema de cotización, reservas y pagos para **Aura Cleaners** (Montréal, QC).
Dominio de producción: **booking.auracleaners.ca**

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Postgres + Auth para el dashboard admin)
- **Stripe** (depósito 40% + saldo 60% + suscripciones recurrentes)
- **Google Calendar API** (cuenta de servicio) para agenda y disponibilidad
- **Resend** para emails transaccionales
- **Tailwind CSS** con la paleta Aura, trilingüe EN / FR / ES

---

## 1. Instalación local

```bash
cd booking-app
npm install
cp .env.example .env.local   # completa los valores
npm run dev                  # http://localhost:3000
```

Rutas principales:

| Ruta | Descripción |
|------|-------------|
| `/quote` | Cotizador interactivo (13 pasos) |
| `/book/[quoteId]` | Confirmación + pago del 40% |
| `/confirmation/[bookingId]` | Confirmación post-pago |
| `/reschedule/[bookingId]` | Reagendamiento self-service |
| `/admin` | Dashboard admin (protegido) |

## 2. Base de datos (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden:
   - [`supabase/schema.sql`](supabase/schema.sql) — tablas, enums, RLS.
   - [`supabase/seed.sql`](supabase/seed.sql) — catálogo de servicios + 3 cleaners de prueba.
3. Copia `Project URL`, `anon key` y `service_role key` a `.env.local`.

### Crear un usuario admin

Authentication → Users → **Add user** (email + password). Ese usuario podrá
entrar a `/admin/login`. El acceso público al cotizador **no** requiere login;
la escritura de reservas ocurre server-side con la `service_role key`.

## 3. Stripe

Ver [`docs/STRIPE_SETUP.md`](docs/STRIPE_SETUP.md). Resumen:

- Usa claves **test** (`pk_test_…`, `sk_test_…`).
- El 40% se cobra vía **Checkout** (guardando la tarjeta con `setup_future_usage`).
- El 60% se cobra **off_session** desde `/admin/payments` reutilizando la tarjeta.
- Los planes recurrentes crean una **Subscription** de Stripe automáticamente.
- Configura el **webhook** apuntando a `/api/stripe/webhook`.

## 4. Google Calendar

Ver la guía paso a paso en [`docs/GOOGLE_CALENDAR_SETUP.md`](docs/GOOGLE_CALENDAR_SETUP.md).
Calendario de prueba: `grondon@araucagroup.com`.

## 5. Emails (Resend)

- Crea una API key en [resend.com](https://resend.com).
- Verifica el dominio `auracleaners.ca` para enviar desde `reservas@auracleaners.ca`.
- Notificaciones al admin: `gabriel@araucamedia.com` (`ADMIN_NOTIFICATION_EMAIL`).

## 6. Deployment (Vercel)

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Modelo de precios

Definido en [`src/lib/pricing.ts`](src/lib/pricing.ts) y sembrado en `services`:

- Tarifa base **$35 CAD/hora**.
- Factor habitaciones: 1–2 → ×1, 3–4 → ×2, 4+ → ×2.5 (solo servicios base).
- Descuento primera visita: **10%**.
- Descuento recurrencia: Mensual 5%, Quincenal 8%, Semanal 10% (acumulables).
- Ítems de precio fijo ($35): ventanas interiores, insumos de limpieza.
- Ítems "Request a quote": post-renovación, remoción de nieve, meal prep,
  riego de plantas, limpieza de piscina → generan solicitud manual (no pago).

> El precio se recalcula **siempre en el servidor** (`/api/quotes`) contra el
> catálogo real, nunca se confía en el total enviado por el navegador.

## Horario operativo

Lunes a Sábado, 9:00–18:00, zona horaria `America/Toronto`. Configurable en
[`src/lib/utils.ts`](src/lib/utils.ts).

## Estructura

```
src/
  app/                 # rutas (App Router) + API routes
    api/               # quotes, checkout, stripe/webhook, availability,
                       # payments/charge-remaining, reschedule
    admin/             # dashboard protegido
  components/          # QuoteWizard, admin, formularios
  lib/                 # pricing, stripe, google-calendar, resend, i18n…
supabase/              # schema.sql, seed.sql
docs/                  # guías de configuración
```
# aura-booking
