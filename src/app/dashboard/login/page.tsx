"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLogin() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Mensaje claro y amigable, sin exponer detalles técnicos de Supabase.
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "Email o contraseña incorrectos. Verifica e intenta de nuevo."
          : "No pudimos iniciar sesión. Revisa tus datos e intenta otra vez."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={signIn} className="card w-full max-w-sm">
        {/* Logo Aura Cleaners */}
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-aura-brown">Aura Cleaners</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-aura-terracota">
            Panel de administración
          </p>
        </div>

        <label className="mb-1 block text-xs font-medium text-aura-brown/70">Email</label>
        <input
          className="field mb-4"
          type="email"
          placeholder="tucorreo@auracleaners.ca"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="mb-1 block text-xs font-medium text-aura-brown/70">Contraseña</label>
        <input
          className="field mb-4"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Ingresando…" : "Ingresar al panel"}
        </button>

        <p className="mt-6 text-center text-xs text-aura-brown/40">
          Acceso exclusivo para el equipo de Aura Cleaners.
        </p>
      </form>
    </main>
  );
}
