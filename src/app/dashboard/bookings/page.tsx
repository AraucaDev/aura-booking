import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCAD } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const supabase = createServerSupabase();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, clients(name, email), quotes(service_type, total), cleaners(name)")
    .order("service_date", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold text-aura-brown">Reservas</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-aura-cream text-left text-aura-brown/60">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Hora</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Profesional</th>
              <th className="p-3">Servicio</th>
              <th className="p-3">Total</th>
              <th className="p-3">40%</th>
              <th className="p-3">60%</th>
              <th className="p-3">Estado</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b: any) => (
              <tr key={b.id} className="border-t border-aura-terracota/10">
                <td className="p-3">{b.service_date}</td>
                <td className="p-3">{String(b.service_time).slice(0, 5)}</td>
                <td className="p-3">{b.clients?.name ?? "—"}</td>
                <td className="p-3">{b.cleaners?.name ?? "— sin asignar"}</td>
                <td className="p-3">{b.quotes?.service_type ?? "—"}</td>
                <td className="p-3">{formatCAD(Number(b.quotes?.total ?? 0))}</td>
                <td className="p-3"><PayFlag status={b.payment_40_status} /></td>
                <td className="p-3"><PayFlag status={b.payment_60_status} /></td>
                <td className="p-3"><StatusBadge status={b.status} /></td>
                <td className="p-3">
                  <Link href={`/reschedule/${b.id}`} className="text-aura-brown underline">Reagendar</Link>
                </td>
              </tr>
            ))}
            {(!bookings || bookings.length === 0) && (
              <tr><td colSpan={10} className="p-4 text-center text-aura-brown/50">Sin reservas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayFlag({ status }: { status: string }) {
  const ok = status === "paid";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
      {ok ? "✓" : status}
    </span>
  );
}
