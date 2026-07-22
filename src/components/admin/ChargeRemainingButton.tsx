"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChargeRemainingButton({
  bookingId,
  amountLabel,
}: {
  bookingId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function charge() {
    if (!confirm(`¿Cobrar ${amountLabel} (60%) a este cliente?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payments/charge-remaining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMsg(data.status === "succeeded" ? "✓ Cobrado" : data.status);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn-primary px-4 py-2 text-xs" disabled={loading} onClick={charge}>
        {loading ? "Cobrando…" : "Cobrar 60%"}
      </button>
      {msg && <p className="mt-1 text-xs text-aura-brown/70">{msg}</p>}
    </div>
  );
}
