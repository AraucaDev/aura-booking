# Configurar Stripe (pagos 40/60 + suscripciones)

## 1. Claves de API (modo test)

1. En [dashboard.stripe.com](https://dashboard.stripe.com/test/apikeys) (modo **Test**).
2. Copia:
   - **Publishable key** → `STRIPE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`
3. Moneda: el sistema cobra en **CAD**.

## 2. Webhook

El webhook confirma la reserva, crea el evento de Calendar, envía emails y crea
la suscripción recurrente.

### En local (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

El CLI imprime un `whsec_…` → ponlo en `STRIPE_WEBHOOK_SECRET`.
Dispara un evento de prueba: `stripe trigger checkout.session.completed`.

### En producción

1. **Developers → Webhooks → Add endpoint**.
2. URL: `https://booking.auracleaners.ca/api/stripe/webhook`.
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copia el **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

## 3. Flujo de pagos

### Depósito 40% (al reservar)

- `/api/checkout` crea una **Checkout Session** (`mode: payment`) por el 40%.
- Usa `setup_future_usage: "off_session"` para **guardar la tarjeta**.
- Al completarse, el webhook marca `payment_40_status = paid` y
  `status = confirmed`.

### Saldo 60% (al completar el servicio)

- Desde `/admin/payments`, el botón **Cobrar 60%** llama a
  `/api/payments/charge-remaining`.
- Se recupera el método de pago del depósito y se crea un **PaymentIntent
  off_session** (`confirm: true`) por el 60%.
- Requiere que la tarjeta guardada permita cobros off_session.

### Suscripciones recurrentes

- Si la frecuencia es Mensual / Quincenal / Semanal, tras el depósito el webhook
  crea una **Subscription** de Stripe con la tarjeta guardada:
  - `weekly` → cada 1 semana
  - `biweekly` → cada 2 semanas
  - `monthly` → cada 1 mes
- El primer cargo recurrente se ancla a la **próxima visita** (`trial_end`), para
  no duplicar el cobro de la primera limpieza.
- Se guarda en la tabla `subscriptions`.

## 4. Tarjetas de prueba

| Escenario | Número |
|-----------|--------|
| Pago exitoso | `4242 4242 4242 4242` |
| Requiere autenticación (3DS) | `4000 0025 0000 3155` |
| Off_session que falla | `4000 0000 0000 9995` |

Fecha futura cualquiera, CVC cualquiera, código postal cualquiera.

## 5. Notas de producción

- Cambia a claves **live** y verifica el dominio.
- Activa `Radar` para prevención de fraude.
- Los cobros off_session pueden requerir autenticación; si `payment_intent`
  queda en `requires_action`, notifica al cliente para completar el pago
  (mejora futura: enviar un link de pago).
