"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cleaner, CleanerAvailability } from "@/lib/types";
import { classNames } from "@/lib/utils";

const WEEKDAYS = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
  { n: 6, label: "Sábado" },
  { n: 0, label: "Domingo" },
];

export function CleanerCard({
  cleaner,
  availability,
  onChanged,
}: {
  cleaner: Cleaner;
  availability: CleanerAvailability[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: cleaner.name,
    email: cleaner.email ?? "",
    phone: cleaner.phone ?? "",
    hourly_rate: String(cleaner.hourly_rate ?? 35),
    status: cleaner.status,
    notes: cleaner.notes ?? "",
  });
  const [avatar, setAvatar] = useState(cleaner.avatar_url);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function saveField(patch: Partial<Record<string, unknown>>) {
    setSaving(true);
    const { error } = await supabase.from("cleaners").update(patch).eq("id", cleaner.id);
    setSaving(false);
    flash(error ? `Error: ${error.message}` : "Guardado ✓");
  }

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith("image/")) return flash("El archivo debe ser una imagen");
    if (file.size > 5 * 1024 * 1024) return flash("La imagen no debe superar 5 MB");

    setSaving(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${cleaner.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("cleaner-avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      setSaving(false);
      return flash(`Error al subir: ${upErr.message}`);
    }

    const { data } = supabase.storage.from("cleaner-avatars").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from("cleaners").update({ avatar_url: url }).eq("id", cleaner.id);
    setAvatar(url);
    setSaving(false);
    flash("Foto actualizada ✓");
  }

  async function removeCleaner() {
    // Avisar si tiene reservas futuras: normalmente conviene desactivar, no borrar.
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("cleaner_id", cleaner.id)
      .gte("service_date", today)
      .in("status", ["pending_payment", "confirmed", "in_progress"]);

    const futuras = count ?? 0;
    const aviso =
      futuras > 0
        ? `⚠️ ${cleaner.name} tiene ${futuras} reserva(s) futura(s).\n\nSi lo borras, esas reservas quedarán SIN profesional asignado.\nNormalmente es mejor marcarlo como "inactivo".\n\n¿Borrar de todas formas?`
        : `¿Borrar a ${cleaner.name}? Esta acción no se puede deshacer.`;

    if (!confirm(aviso)) return;

    setSaving(true);
    const { error } = await supabase.from("cleaners").delete().eq("id", cleaner.id);
    setSaving(false);
    if (error) return flash(`Error: ${error.message}`);
    onChanged();
  }

  async function saveDay(weekday: number, patch: Partial<CleanerAvailability>) {
    const existing = availability.find((a) => a.weekday === weekday);
    if (existing) {
      await supabase.from("cleaner_availability").update(patch).eq("id", existing.id);
    } else {
      await supabase.from("cleaner_availability").insert({
        cleaner_id: cleaner.id,
        weekday,
        start_time: "09:00",
        end_time: "18:00",
        active: true,
        ...patch,
      });
    }
    onChanged();
  }

  const inactive = form.status === "inactive";

  return (
    <div className={classNames("card", inactive && "opacity-60")}>
      {/* Cabecera: foto + datos principales */}
      <div className="flex gap-4">
        <div className="shrink-0 text-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative block h-20 w-20 overflow-hidden rounded-full border-2 border-aura-sand bg-aura-cream"
            title="Cambiar foto"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={cleaner.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-2xl text-aura-terracota">
                {cleaner.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-aura-brown/60 text-[10px] font-medium text-white group-hover:flex">
              Cambiar
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
          <p className="mt-1 text-[10px] text-aura-brown/40">ID {cleaner.id}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="field font-medium"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => saveField({ name: form.name })}
            placeholder="Nombre"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => saveField({ email: form.email })}
              placeholder="Email"
            />
            <input
              className="field"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onBlur={() => saveField({ phone: form.phone })}
              placeholder="Teléfono"
            />
          </div>
        </div>
      </div>

      {/* Tarifa y estado */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-aura-brown/70">
            Tarifa por hora (CAD)
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-aura-brown/50">
              $
            </span>
            <input
              className="field pl-8"
              type="number"
              min={0}
              step="0.5"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              onBlur={() => saveField({ hourly_rate: Number(form.hourly_rate) || 35 })}
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-aura-brown/70">Estado</span>
          <select
            className="field"
            value={form.status}
            onChange={(e) => {
              const status = e.target.value as Cleaner["status"];
              setForm({ ...form, status });
              saveField({ status });
            }}
          >
            <option value="active">Activo (visible para clientes)</option>
            <option value="inactive">Inactivo (oculto)</option>
          </select>
        </label>
      </div>

      {/* Horarios */}
      <button
        type="button"
        onClick={() => setShowSchedule((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-aura-cream px-4 py-2 text-sm font-medium text-aura-brown"
      >
        <span>Disponibilidad semanal</span>
        <span className="text-aura-terracota">{showSchedule ? "▲ ocultar" : "▼ editar"}</span>
      </button>

      {showSchedule && (
        <div className="mt-3 space-y-1.5">
          {WEEKDAYS.map(({ n, label }) => {
            const day = availability.find((a) => a.weekday === n);
            const active = day?.active ?? false;
            return (
              <div key={n} className="flex items-center gap-2 text-sm">
                <label className="flex w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => saveDay(n, { active: e.target.checked })}
                    className="h-4 w-4 accent-[#7A4A1E]"
                  />
                  <span className={active ? "text-aura-brown" : "text-aura-brown/40"}>{label}</span>
                </label>
                <input
                  type="time"
                  disabled={!active}
                  value={(day?.start_time ?? "09:00:00").slice(0, 5)}
                  onChange={(e) => saveDay(n, { start_time: e.target.value })}
                  className="rounded-lg border border-aura-terracota/40 px-2 py-1 disabled:opacity-40"
                />
                <span className="text-aura-brown/40">a</span>
                <input
                  type="time"
                  disabled={!active}
                  value={(day?.end_time ?? "18:00:00").slice(0, 5)}
                  onChange={(e) => saveDay(n, { end_time: e.target.value })}
                  className="rounded-lg border border-aura-terracota/40 px-2 py-1 disabled:opacity-40"
                />
              </div>
            );
          })}
          <p className="pt-1 text-xs text-aura-brown/40">
            Entre un servicio y otro se reserva automáticamente 1 hora de traslado.
          </p>
        </div>
      )}

      {/* Pie */}
      <div className="mt-4 flex items-center justify-between border-t border-aura-terracota/15 pt-3">
        <span className="text-xs text-aura-brown/60">
          {saving ? "Guardando…" : msg ?? ""}
        </span>
        <button
          type="button"
          onClick={removeCleaner}
          className="text-xs text-red-600 hover:underline"
        >
          Borrar cleaner
        </button>
      </div>
    </div>
  );
}
