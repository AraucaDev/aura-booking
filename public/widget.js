/**
 * Aura Cleaners — Widget de cotización embebible
 * Uso en cualquier sitio (auracleaners.ca en GoDaddy, HTML/PHP, etc.):
 *
 *   <div id="aura-quote-widget"></div>
 *   <script src="https://booking.auracleaners.ca/widget.js"></script>
 *
 * El script inyecta un iframe con el cotizador completo servido desde
 * booking.auracleaners.ca, lo hace responsive, auto-ajusta su altura y
 * gestiona el "breakout" hacia Stripe Checkout (que no puede vivir en iframe).
 */
(function () {
  "use strict";

  // Origen desde el que se cargó este script (ej. https://booking.auracleaners.ca)
  var scriptEl = document.currentScript;
  var HOST = (function () {
    try {
      return new URL(scriptEl.src).origin;
    } catch (e) {
      return "https://booking.auracleaners.ca";
    }
  })();

  var MOUNT_ID = "aura-quote-widget";

  function mount() {
    var container = document.getElementById(MOUNT_ID);
    if (!container || container.getAttribute("data-aura-mounted") === "1") return;
    container.setAttribute("data-aura-mounted", "1");

    // Idioma opcional: <div id="aura-quote-widget" data-lang="es"></div>
    var lang = container.getAttribute("data-lang") || "";
    var src = HOST + "/quote?embed=1" + (lang ? "&lang=" + encodeURIComponent(lang) : "");

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Aura Cleaners — Cotizador";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allow", "payment");
    iframe.style.width = "100%";
    iframe.style.minWidth = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";
    iframe.style.background = "#FCF7F0"; // Aura cream
    iframe.style.borderRadius = "16px";
    iframe.style.height = "760px"; // altura inicial; se ajusta por postMessage

    container.style.width = "100%";
    container.appendChild(iframe);

    // Recibir mensajes del cotizador (solo desde el HOST por seguridad).
    window.addEventListener("message", function (event) {
      if (event.origin !== HOST || !event.data || typeof event.data !== "object") return;

      if (event.data.type === "aura:resize" && event.data.height) {
        iframe.style.height = Math.max(480, Math.ceil(event.data.height)) + "px";
      }

      // Stripe Checkout no puede embeberse: redirigimos a nivel superior.
      if (event.data.type === "aura:redirect" && event.data.url) {
        window.top.location.href = event.data.url;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
