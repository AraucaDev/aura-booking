import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminClients() {
  const supabase = createServerSupabase();
  const { data: clients } = await supabase
    .from("clients")
    .select("*, bookings(id)")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold text-aura-brown">Clientes</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-aura-cream text-left text-aura-brown/60">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Idioma</th>
              <th className="p-3">Reservas</th>
              <th className="p-3">Alta</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-aura-terracota/10">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{c.phone ?? "—"}</td>
                <td className="p-3 uppercase">{c.language}</td>
                <td className="p-3">{c.bookings?.length ?? 0}</td>
                <td className="p-3">{String(c.created_at).slice(0, 10)}</td>
              </tr>
            ))}
            {(!clients || clients.length === 0) && (
              <tr><td colSpan={6} className="p-4 text-center text-aura-brown/50">Sin clientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
