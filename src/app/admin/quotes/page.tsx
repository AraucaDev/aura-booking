import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCAD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminQuotes() {
  const supabase = createServerSupabase();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("*, clients(name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold text-aura-brown">Cotizaciones</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-aura-cream text-left text-aura-brown/60">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Servicio</th>
              <th className="p-3">Frecuencia</th>
              <th className="p-3">Total</th>
              <th className="p-3">Estado</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).map((q: any) => (
              <tr key={q.id} className="border-t border-aura-terracota/10">
                <td className="p-3">{String(q.created_at).slice(0, 10)}</td>
                <td className="p-3">{q.clients?.name ?? "—"}<br /><span className="text-xs text-aura-brown/50">{q.clients?.email}</span></td>
                <td className="p-3">{q.service_type}</td>
                <td className="p-3">{q.frequency}</td>
                <td className="p-3">{formatCAD(Number(q.total))}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    q.status === "converted" ? "bg-green-100 text-green-800"
                    : q.status === "request_quote" ? "bg-orange-100 text-orange-800"
                    : "bg-yellow-100 text-yellow-800"}`}>{q.status}</span>
                </td>
                <td className="p-3">
                  <Link href={`/book/${q.id}`} className="text-aura-brown underline">Ver / cobrar</Link>
                </td>
              </tr>
            ))}
            {(!quotes || quotes.length === 0) && (
              <tr><td colSpan={7} className="p-4 text-center text-aura-brown/50">Sin cotizaciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
