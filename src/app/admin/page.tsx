import { createServerSupabase } from "@/lib/supabase/server";
import { formatCAD } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: todayBookings }, { data: pendingQuotes }, { data: pending60 }, { data: allClients }] =
    await Promise.all([
      supabase.from("bookings").select("*, clients(name)").eq("service_date", today).order("service_time"),
      supabase.from("quotes").select("id").in("status", ["pending", "request_quote"]),
      supabase.from("bookings").select("payment_60_amount").eq("status", "completed").neq("payment_60_status", "paid"),
      supabase.from("clients").select("id"),
    ]);

  const revenueToday = (todayBookings ?? []).reduce(
    (sum, b: any) => sum + (b.payment_40_status === "paid" ? Number(b.payment_40_amount || 0) : 0),
    0
  );
  const pendingRevenue = (pending60 ?? []).reduce((s, b: any) => s + Number(b.payment_60_amount || 0), 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-aura-brown">Hoy</h1>
      <p className="mb-6 text-sm text-aura-brown/60">{today}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reservas hoy" value={String(todayBookings?.length ?? 0)} />
        <Stat label="Ingreso 40% hoy" value={formatCAD(revenueToday)} />
        <Stat label="Cotizaciones pendientes" value={String(pendingQuotes?.length ?? 0)} />
        <Stat label="60% por cobrar" value={formatCAD(pendingRevenue)} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl text-aura-brown">Agenda de hoy</h2>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-aura-cream text-left text-aura-brown/60">
            <tr>
              <th className="p-3">Hora</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(todayBookings ?? []).map((b: any) => (
              <tr key={b.id} className="border-t border-aura-terracota/10">
                <td className="p-3 font-medium">{String(b.service_time).slice(0, 5)}</td>
                <td className="p-3">{b.clients?.name ?? "—"}</td>
                <td className="p-3"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
            {(!todayBookings || todayBookings.length === 0) && (
              <tr><td colSpan={3} className="p-4 text-center text-aura-brown/50">Sin reservas hoy.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-widest text-aura-terracota">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-aura-brown">{value}</p>
    </div>
  );
}
