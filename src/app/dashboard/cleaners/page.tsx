"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cleaner, CleanerAvailability } from "@/lib/types";
import { CleanerCard } from "@/components/admin/CleanerCard";

export const dynamic = "force-dynamic";

export default function DashboardCleaners() {
  const supabase = createClient();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [availability, setAvailability] = useState<Record<number, CleanerAvailability[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: cs, error: cErr }, { data: av }] = await Promise.all([
      supabase.from("cleaners").select("*").order("id"),
      supabase.from("cleaner_availability").select("*").order("weekday"),
    ]);
    if (cErr) setError(cErr.message);
    setCleaners((cs as Cleaner[]) ?? []);

    const grouped: Record<number, CleanerAvailability[]> = {};
    for (const a of (av as CleanerAvailability[]) ?? []) {
      (grouped[a.cleaner_id] ??= []).push(a);
    }
    setAvailability(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCleaner() {
    setError(null);
    const { data, error } = await supabase
      .from("cleaners")
      .insert({ name: "Nuevo profesional", status: "active", hourly_rate: 35 })
      .select("*")
      .single();
    if (error) return setError(error.message);

    // Horario por defecto: Lun–Sáb 9:00–18:00, domingo cerrado.
    const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      cleaner_id: (data as Cleaner).id,
      weekday,
      start_time: "09:00",
      end_time: "18:00",
      active: weekday !== 0,
    }));
    await supabase.from("cleaner_availability").insert(rows);
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-aura-brown">Cleaners</h1>
          <p className="text-sm text-aura-brown/60">
            Foto, tarifa por hora y disponibilidad semanal de cada profesional.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={addCleaner}>
          + Agregar cleaner
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-aura-brown/60">Cargando…</p>
      ) : cleaners.length === 0 ? (
        <div className="card text-center text-aura-brown/60">
          Aún no hay cleaners. Agrega el primero con el botón de arriba.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cleaners.map((c) => (
            <CleanerCard
              key={c.id}
              cleaner={c}
              availability={availability[c.id] ?? []}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
