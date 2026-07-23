import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCAD } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: { bookingId: string } }) {
  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, quotes(*), clients(*)")
    .eq("id", params.bookingId)
    .maybeSingle();
  if (!booking) notFound();

  const quote = (booking as any).quotes;
  const client = (booking as any).clients;
  const lang = (client?.language ?? "en") as Lang;

  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-aura-brown text-3xl text-aura-sand">
        ✓
      </div>
      <h1 className="font-display text-3xl font-semibold text-aura-brown">{t(lang, "confirmed_title")}</h1>
      <p className="mt-2 text-aura-brown/70">{t(lang, "confirmed_body")}</p>

      <div className="card mt-8 text-left text-sm">
        <Row label={t(lang, "full_name")} value={client?.name ?? ""} />
        <Row label={t(lang, "service")} value={quote?.service_type ?? ""} />
        <Row label={t(lang, "date")} value={booking.service_date} />
        <Row label={t(lang, "time")} value={String(booking.service_time).slice(0, 5)} />
        <Row label={t(lang, "address")} value={booking.address ?? ""} />
        <div className="my-3 border-t border-aura-terracota/20" />
        <Row label={t(lang, "pay_now")} value={formatCAD(Number(booking.payment_40_amount ?? 0), lang)} />
        <Row label={t(lang, "pay_later")} value={formatCAD(Number(booking.payment_60_amount ?? 0), lang)} />
        <Row label={t(lang, "total")} value={formatCAD(Number(quote?.total ?? 0), lang)} bold />
      </div>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={`/reschedule/${booking.id}`} className="btn-outline">
          {t(lang, "reschedule")}
        </Link>
        <a
          href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://auracleaners.ca"}
          className="btn-primary"
        >
          {t(lang, "back_home")}
        </a>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-aura-brown/60">{label}</span>
      <span className={bold ? "font-semibold text-aura-brown" : "text-aura-brown"}>{value}</span>
    </div>
  );
}
