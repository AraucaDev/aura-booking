"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { classNames } from "@/lib/utils";

export function RescheduleForm({
  bookingId,
  lang,
  currentDate,
  currentTime,
  duration,
  cleanerId,
  locked,
}: {
  bookingId: string;
  lang: Lang;
  currentDate: string;
  currentTime: string;
  duration: number;
  cleanerId: number | null;
  locked: boolean;
}) {
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!date || locked || !cleanerId) return;
    setLoading(true);
    setTime("");
    // Se excluye esta misma reserva para que no bloquee su propio horario.
    fetch(
      `/api/availability?date=${date}&duration=${Math.ceil(duration)}` +
        `&cleanerId=${cleanerId}&excludeBookingId=${bookingId}`
    )
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setLoading(false));
  }, [date, duration, locked, cleanerId, bookingId]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, date, time }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? "✓ " + t(lang, "confirmed_title") : data.error || "Error");
  }

  if (locked) {
    return (
      <div className="card mt-6 text-aura-brown/70">
        Esta reserva no puede reagendarse.
      </div>
    );
  }

  return (
    <div className="card mt-6">
      <h1 className="font-display text-2xl text-aura-brown">{t(lang, "reschedule")}</h1>
      <p className="mt-1 text-sm text-aura-brown/60">
        Actual: {currentDate} {currentTime}
      </p>
      <input
        type="date"
        className="field my-4"
        value={date}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
      />
      {loading ? (
        <p className="text-aura-brown/60">{t(lang, "loading")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <button
              key={s.time}
              type="button"
              disabled={!s.available}
              onClick={() => setTime(s.time)}
              className={classNames(
                "rounded-xl border px-3 py-2 text-sm",
                !s.available && "cursor-not-allowed border-transparent bg-aura-cream text-aura-brown/30 line-through",
                s.available && time === s.time && "border-aura-brown bg-aura-brown text-aura-sand",
                s.available && time !== s.time && "border-aura-terracota/40 text-aura-brown hover:border-aura-brown"
              )}
            >
              {s.time}
            </button>
          ))}
        </div>
      )}
      <button className="btn-primary mt-6 w-full disabled:opacity-40" disabled={!time || saving} onClick={save}>
        {saving ? t(lang, "processing") : t(lang, "reschedule")}
      </button>
      {msg && <p className="mt-3 text-center text-sm text-aura-brown">{msg}</p>}
    </div>
  );
}
