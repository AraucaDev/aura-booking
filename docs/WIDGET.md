# Widget embebible del cotizador

Permite incrustar el cotizador completo de Aura Cleaners en cualquier sitio
(auracleaners.ca en GoDaddy, HTML/PHP, WordPress, etc.) sin que el usuario
salga de la página.

## Código de embed

Pega esto donde quieras que aparezca el cotizador:

```html
<div id="aura-quote-widget"></div>
<script src="https://booking.auracleaners.ca/widget.js"></script>
```

Opcional — fijar el idioma inicial (`en` | `fr` | `es`):

```html
<div id="aura-quote-widget" data-lang="es"></div>
<script src="https://booking.auracleaners.ca/widget.js"></script>
```

## Cómo funciona

- `widget.js` inyecta un **iframe** que carga `booking.auracleaners.ca/quote?embed=1`.
- El cotizador corre en el dominio de booking → usa la misma API y base de datos,
  sin problemas de CORS.
- **Auto-alto**: el cotizador reporta su altura por `postMessage` y el iframe se
  ajusta solo (sin scroll interno).
- **Responsive**: ocupa el 100% del ancho del contenedor; funciona en mobile,
  tablet y desktop.
- **Pago con Stripe**: como Stripe Checkout no puede mostrarse dentro de un iframe,
  al pagar el widget redirige la ventana superior (`window.top`) a Stripe y luego
  a la página de confirmación.

## Seguridad

- El sitio principal solo acepta mensajes provenientes de `booking.auracleaners.ca`.
- El cotizador solo puede embeberse desde los dominios listados en
  `next.config.js` → `FRAME_ANCESTORS` (por defecto: `auracleaners.ca` y
  `www.auracleaners.ca`). Para autorizar otro dominio, agrégalo ahí y redeploya.

## Probar

- Local: abre `http://localhost:3000/widget-demo.html`.
- Producción: `https://booking.auracleaners.ca/widget-demo.html`.

## Instalar en GoDaddy (sitio HTML/PHP)

1. Edita la página donde quieres el cotizador (ej. `cotizar.html` o un bloque HTML).
2. Pega el código de embed en el lugar deseado del `<body>`.
3. Guarda y publica. El widget aparece automáticamente.

> En un editor visual (GoDaddy Website Builder), añade un bloque **HTML / Código
> personalizado** y pega ahí el snippet.
