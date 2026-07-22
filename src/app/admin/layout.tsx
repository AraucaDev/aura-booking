import { createServerSupabase } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La página de login se renderiza sin navegación.
  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <AdminNav email={user.email ?? ""} />
      <main className="flex-1 overflow-x-auto bg-aura-cream p-6">{children}</main>
    </div>
  );
}
