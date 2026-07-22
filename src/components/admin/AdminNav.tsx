"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/bookings", label: "Reservas" },
  { href: "/admin/quotes", label: "Cotizaciones" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/cleaners", label: "Cleaners" },
  { href: "/admin/calendar", label: "Calendario" },
  { href: "/admin/payments", label: "Pagos" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-aura-terracota/20 bg-white p-4">
      <p className="font-display text-xl font-semibold text-aura-brown">Aura Admin</p>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={classNames(
                "rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-aura-brown text-aura-sand" : "text-aura-brown/70 hover:bg-aura-sand/30"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-aura-terracota/20 pt-3">
        <p className="truncate text-xs text-aura-brown/50">{email}</p>
        <button onClick={signOut} className="mt-2 text-sm text-aura-brown/70 hover:text-aura-brown">
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
