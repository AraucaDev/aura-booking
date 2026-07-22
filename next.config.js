/** @type {import('next').NextConfig} */

// Sitios autorizados a embeber el cotizador (widget). Añade aquí otros dominios.
const FRAME_ANCESTORS = [
  "'self'",
  "https://auracleaners.ca",
  "https://www.auracleaners.ca",
].join(" ");

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  async redirects() {
    // Compatibilidad: enlaces antiguos /admin/* redirigen al nuevo /dashboard/*.
    return [
      { source: "/admin", destination: "/dashboard", permanent: true },
      { source: "/admin/:path*", destination: "/dashboard/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Permitir que el cotizador se muestre dentro de un iframe en el sitio principal.
        source: "/quote",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS};` },
        ],
      },
      {
        // El script de embed debe ser accesible desde cualquier origen.
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
