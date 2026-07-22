import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCAD } from "@/lib/utils";
import { PayButton } from "@/components/PayButton";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: { quoteId: string } }) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, clients(*)")
    .eq("id", params.quoteId)
    .maybeSingle();
  if (!quote) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("quote_id", params.quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const client = (quote as any).clients;
  const lang = quote.language || "en";
  const pay40 = booking ? Number(booking.payment_40_amount) : Number(quote.total) * 0.4;
  const pay60 = booking ? Number(booking.payment_60_amount) : Number(quote.total) * 0.6;
  const alreadyPaid = booking?.payment_40_status === "paid";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="font-display text-2xl font-semibold text-aura-brown">Aura Cleaners</p>
      <div className="card mt-6">
        <h1 className="font-display text-2xl text-aura-brown">Confirma tu reserva</h1>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Cliente" value={client?.name ?? ""} />
          <Row label="Servicio" value={quote.service_type} />
          <Row label="Frecuencia" value={quote.frequency} />
          {booking && <Row label="Fecha" value={`${booking.service_date} ${String(booking.service_time).slice(0, 5)}`} />}
          <Row label="Dirección" value={booking?.address ?? client?.address ?? ""} />
          <div className="my-3 border-t border-aura-terracota/20" />
          <Row label="Subtotal" value={formatCAD(Number(quote.subtotal), lang)} />
          {Number(quote.discount_amount) > 0 && (
            <Row label="Descuento" value={`−${formatCAD(Number(quote.discount_amount), lang)}`} />
          )}
          <Row label="Total" value={formatCAD(Number(quote.total), lang)} bold />
          <div className="my-3 border-t border-aura-terracota/20" />
          <Row label="Pagar ahora (40%)" value={formatCAD(pay40, lang)} bold />
          <Row label="Al completar (60%)" value={formatCAD(pay60, lang)} />
        </div>

        <div className="mt-6">
          {alreadyPaid ? (
            <p className="rounded-xl bg-aura-sand/40 p-4 text-center text-sm text-aura-brown">
              Esta reserva ya fue pagada. Revisa tu correo de confirmación.
            </p>
          ) : booking ? (
            <PayButton bookingId={booking.id} amountLabel={formatCAD(pay40, lang)} />
          ) : (
            <p className="text-sm text-aura-brown/60">
              Esta cotización aún no tiene una reserva asociada.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-aura-brown/60">{label}</span>
      <span className={bold ? "font-semibold text-aura-brown" : "text-aura-brown"}>{value}</span>
    </div>
  );
}
