import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const duration = Number(searchParams.get("duration") || "1");
  const cleanerId = Number(searchParams.get("cleanerId") || "0");
  const excludeBookingId = searchParams.get("excludeBookingId") || undefined;

  if (!date) return NextResponse.json({ error: "date requerido" }, { status: 400 });
  if (!cleanerId) return NextResponse.json({ error: "cleanerId requerido" }, { status: 400 });

  const slots = await getAvailableSlots(date, duration, cleanerId, excludeBookingId);
  return NextResponse.json({ slots });
}
