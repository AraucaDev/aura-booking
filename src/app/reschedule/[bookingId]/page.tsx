import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { RescheduleForm } from "@/components/RescheduleForm";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReschedulePage({ params }: { params: { bookingId: string } }) {
  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, service_date, service_time, duration_hours, status, clients(language)")
    .eq("id", params.bookingId)
    .maybeSingle();
  if (!booking) notFound();

  const lang = ((booking as any).clients?.language ?? "en") as Lang;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="font-display text-2xl font-semibold text-aura-brown">Aura Cleaners</p>
      <RescheduleForm
        bookingId={booking.id}
        lang={lang}
        currentDate={booking.service_date}
        currentTime={String(booking.service_time).slice(0, 5)}
        duration={Number(booking.duration_hours || 1)}
        locked={["completed", "cancelled"].includes(booking.status)}
      />
    </main>
  );
}
