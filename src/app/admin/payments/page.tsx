import { createServerSupabase } from "@/lib/supabase/server";
import { formatCAD } from "@/lib/utils";
import { ChargeRemainingButton } from "@/components/admin/ChargeRemainingButton";

export const dynamic = "force-dynamic";

export default async function AdminPayments() {
  const supabase = createServerSupabase();
  // Reservas con 40% pagado y 60% aún pendiente.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, clients(name, email), quotes(service_type)")
    .eq("payment_40_status", "paid")
    .neq("payment_60_status", "paid")
    .order("service_date", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl font-semibold text-aura-brown">Pagos pendientes</h1>
      <p className="mb-6 text-sm text-aura-brown/60">Cobra el 60% restante al completar el servicio.</p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-aura-cream text-left text-aura-brown/60">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Servicio</th>
              <th className="p-3">60% restante</th>
              <th className="p-3">Estado 60%</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b: any) => (
              <tr key={b.id} className="border-t border-aura-terracota/10">
                <td className="p-3">{b.service_date}</td>
                <td className="p-3">{b.clients?.name}<br /><span className="text-xs text-aura-brown/50">{b.clients?.email}</span></td>
                <td className="p-3">{b.quotes?.service_type}</td>
                <td className="p-3 font-medium">{formatCAD(Number(b.payment_60_amount ?? 0))}</td>
                <td className="p-3">{b.payment_60_status}</td>
                <td className="p-3">
                  <ChargeRemainingButton bookingId={b.id} amountLabel={formatCAD(Number(b.payment_60_amount ?? 0))} />
                </td>
              </tr>
            ))}
            {(!bookings || bookings.length === 0) && (
              <tr><td colSpan={6} className="p-4 text-center text-aura-brown/50">No hay pagos pendientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
