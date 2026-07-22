import { createServerSupabase } from "@/lib/supabase/server";
import { generateDaySlots } from "@/lib/utils";

export const dynamic = "force-dynamic";

function weekDays(base: Date): Date[] {
  const day = base.getDay(); // 0 dom
  const monday = new Date(base);
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(base.getDate() + diff);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default async function AdminCalendar({
  searchParams,
}: {
  searchParams: { start?: string };
}) {
  const base = searchParams.start ? new Date(searchParams.start) : new Date();
  const days = weekDays(base);
  const from = days[0].toISOString().slice(0, 10);
  const to = days[5].toISOString().slice(0, 10);

  const supabase = createServerSupabase();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, clients(name)")
    .gte("service_date", from)
    .lte("service_date", to)
    .not("status", "eq", "cancelled");

  const slots = generateDaySlots();
  const byCell = new Map<string, any[]>();
  for (const b of bookings ?? []) {
    const key = `${b.service_date}_${String(b.service_time).slice(0, 5)}`;
    byCell.set(key, [...(byCell.get(key) ?? []), b]);
  }

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl font-semibold text-aura-brown">Calendario</h1>
      <p className="mb-6 text-sm text-aura-brown/60">Semana {from} — {to} · Lun–Sáb 9:00–18:00</p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="bg-aura-cream text-aura-brown/60">
              <th className="p-2"></th>
              {days.map((d, i) => (
                <th key={i} className="p-2 text-center">
                  {dayNames[i]}<br />
                  <span className="text-aura-brown/40">{d.toISOString().slice(5, 10)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((time) => (
              <tr key={time} className="border-t border-aura-terracota/10">
                <td className="p-2 text-right text-aura-brown/50">{time}</td>
                {days.map((d, i) => {
                  const key = `${d.toISOString().slice(0, 10)}_${time}`;
                  const cell = byCell.get(key) ?? [];
                  return (
                    <td key={i} className="p-1 align-top">
                      {cell.map((b: any) => (
                        <div key={b.id} className="mb-1 rounded-lg bg-aura-sand/60 px-2 py-1 text-aura-brown">
                          {b.clients?.name ?? "—"}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
