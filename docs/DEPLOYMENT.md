# Deployment en Vercel

## 1. Repositorio

Sube `booking-app/` a un repo de GitHub (o conecta este directorio).

## 2. Importar en Vercel

1. [vercel.com/new](https://vercel.com/new) → importa el repo.
2. **Root Directory**: `booking-app` (si el repo contiene más carpetas).
3. Framework: **Next.js** (autodetectado). Build: `next build`.

## 3. Variables de entorno

En **Settings → Environment Variables**, agrega todas las de `.env.example`:

```
NEXT_PUBLIC_APP_URL=https://booking.auracleaners.ca
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_CALENDAR_ID
RESEND_API_KEY
RESEND_FROM_EMAIL
ADMIN_NOTIFICATION_EMAIL
OPERATING_TIMEZONE=America/Toronto
```

> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: pega el valor con `\n` literales entre
> comillas. El código los convierte en saltos reales.

## 4. Dominio

1. **Settings → Domains → Add** → `booking.auracleaners.ca`.
2. En tu DNS, crea un **CNAME** `booking` → `cname.vercel-dns.com`.
3. Espera la verificación + SSL automático.

## 5. Webhook de Stripe (producción)

- Endpoint: `https://booking.auracleaners.ca/api/stripe/webhook`.
- Actualiza `STRIPE_WEBHOOK_SECRET` con el signing secret del endpoint live.

## 6. Post-deploy checklist

- [ ] `schema.sql` y `seed.sql` ejecutados en el Supabase de producción.
- [ ] Usuario admin creado en Supabase Auth.
- [ ] Calendario compartido con la cuenta de servicio (permiso de edición).
- [ ] Dominio de Resend verificado.
- [ ] Webhook de Stripe recibiendo eventos (revisa **Webhooks → Logs**).
- [ ] Prueba end-to-end: cotizar → pagar 40% (tarjeta test) → verificar evento
      en Calendar + email + cobro del 60% desde `/admin/payments`.

## Notas

- Las API routes usan `runtime` Node.js por defecto (necesario para
  `googleapis` y `stripe`). No las marques como Edge.
- `NEXT_PUBLIC_APP_URL` debe apuntar al dominio final para que los `success_url`
  de Stripe y los links de los emails sean correctos.
