import type { Lang } from "./types";
import { formatCAD } from "./utils";

const BRAND = {
  cream: "#FCF7F0",
  sand: "#EDD6AA",
  terracota: "#C39776",
  brown: "#7A4A1E",
};

function shell(title: string, bodyHtml: string): string {
  return `
  <div style="background:${BRAND.cream};padding:32px 0;font-family:Inter,Arial,sans-serif;color:#3a2a17;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(122,74,30,.08);">
      <div style="background:${BRAND.brown};padding:24px 32px;">
        <h1 style="margin:0;color:${BRAND.sand};font-family:Georgia,serif;font-size:24px;letter-spacing:.5px;">Aura Cleaners</h1>
        <p style="margin:4px 0 0;color:${BRAND.cream};font-size:13px;">Clean you can feel.</p>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 16px;color:${BRAND.brown};font-family:Georgia,serif;font-size:20px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px;background:${BRAND.cream};font-size:12px;color:#8a7a63;">
        <p style="margin:0;">Aura Cleaners · booking.auracleaners.ca · Montréal, QC</p>
      </div>
    </div>
  </div>`;
}

const L = {
  en: {
    hi: "Hi",
    booked: "Your booking is confirmed",
    thanks: "Thank you for booking with Aura Cleaners. Here are your details:",
    service: "Service",
    date: "Date",
    time: "Time",
    address: "Address",
    paidNow: "Paid now (40%)",
    dueLater: "Due on completion (60%)",
    total: "Total",
    reschedule: "Need to reschedule?",
    manage: "Manage your booking",
    remaining: "Payment received — thank you!",
    remainingBody: "We've collected the remaining balance for your completed service.",
  },
  fr: {
    hi: "Bonjour",
    booked: "Votre réservation est confirmée",
    thanks: "Merci d'avoir réservé avec Aura Cleaners. Voici vos détails :",
    service: "Service",
    date: "Date",
    time: "Heure",
    address: "Adresse",
    paidNow: "Payé maintenant (40 %)",
    dueLater: "À payer à la fin (60 %)",
    total: "Total",
    reschedule: "Besoin de reprogrammer ?",
    manage: "Gérer votre réservation",
    remaining: "Paiement reçu — merci !",
    remainingBody: "Nous avons perçu le solde restant de votre service complété.",
  },
  es: {
    hi: "Hola",
    booked: "Tu reserva está confirmada",
    thanks: "Gracias por reservar con Aura Cleaners. Estos son tus detalles:",
    service: "Servicio",
    date: "Fecha",
    time: "Hora",
    address: "Dirección",
    paidNow: "Pagado ahora (40%)",
    dueLater: "A pagar al completar (60%)",
    total: "Total",
    reschedule: "¿Necesitas reagendar?",
    manage: "Gestionar tu reserva",
    remaining: "Pago recibido — ¡gracias!",
    remainingBody: "Hemos cobrado el saldo restante de tu servicio completado.",
  },
} as const;

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#8a7a63;font-size:13px;">${label}</td>
    <td style="padding:8px 0;text-align:right;font-weight:600;font-size:14px;">${value}</td>
  </tr>`;
}

export interface BookingEmailData {
  lang: Lang;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  address: string;
  total: number;
  paid40: number;
  due60: number;
  manageUrl: string;
}

export function clientConfirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  const l = L[d.lang] ?? L.en;
  const body = `
    <p style="font-size:14px;">${l.hi} ${d.clientName}, ${l.thanks}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${row(l.service, d.serviceName)}
      ${row(l.date, d.date)}
      ${row(l.time, d.time)}
      ${row(l.address, d.address)}
      <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;"></td></tr>
      ${row(l.paidNow, formatCAD(d.paid40, d.lang))}
      ${row(l.dueLater, formatCAD(d.due60, d.lang))}
      ${row(l.total, formatCAD(d.total, d.lang))}
    </table>
    <a href="${d.manageUrl}" style="display:inline-block;background:${BRAND.brown};color:${BRAND.sand};text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">${l.manage}</a>
  `;
  return { subject: `${l.booked} — Aura Cleaners`, html: shell(l.booked, body) };
}

export function remainingPaidEmail(d: BookingEmailData): { subject: string; html: string } {
  const l = L[d.lang] ?? L.en;
  const body = `
    <p style="font-size:14px;">${l.hi} ${d.clientName}, ${l.remainingBody}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${row(l.service, d.serviceName)}
      ${row(l.dueLater, formatCAD(d.due60, d.lang))}
      ${row(l.total, formatCAD(d.total, d.lang))}
    </table>
  `;
  return { subject: `${l.remaining} — Aura Cleaners`, html: shell(l.remaining, body) };
}

export function adminNotificationEmail(opts: {
  title: string;
  lines: { label: string; value: string }[];
}): { subject: string; html: string } {
  const body = `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;">
      ${opts.lines.map((x) => row(x.label, x.value)).join("")}
    </table>`;
  return { subject: `[Aura] ${opts.title}`, html: shell(opts.title, body) };
}
