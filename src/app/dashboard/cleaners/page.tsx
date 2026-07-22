"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cleaner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function AdminCleaners() {
  const supabase = createClient();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("cleaners").select("*").order("id");
    setCleaners((data as Cleaner[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(id: number, patch: Partial<Cleaner>) {
    setCleaners((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("cleaners").update(patch).eq("id", id);
  }
  async function add() {
    const { data } = await supabase
      .from("cleaners")
      .insert({ name: "Nuevo cleaner", status: "active" })
      .select("*")
      .single();
    if (data) setCleaners((prev) => [...prev, data as Cleaner]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-aura-brown">Cleaners</h1>
        <button className="btn-primary" onClick={add}>+ Agregar</button>
      </div>

      {loading ? (
        <p className="text-aura-brown/60">Cargando…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cleaners.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-aura-brown/40">ID {c.id}</span>
                <select
                  className="rounded-full border border-aura-terracota/40 px-2 py-1 text-xs"
                  value={c.status}
                  onChange={(e) => update(c.id, { status: e.target.value as Cleaner["status"] })}
                >
                  <option value="active">activo</option>
                  <option value="inactive">inactivo</option>
                </select>
              </div>
              <input className="field mt-3" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
              <input className="field mt-2" placeholder="Email" value={c.email ?? ""} onChange={(e) => update(c.id, { email: e.target.value })} />
              <input className="field mt-2" placeholder="Teléfono" value={c.phone ?? ""} onChange={(e) => update(c.id, { phone: e.target.value })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
