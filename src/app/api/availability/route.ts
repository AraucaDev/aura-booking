import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const duration = Number(searchParams.get("duration") || "1");
  if (!date) {
    return NextResponse.json({ error: "date requerido" }, { status: 400 });
  }
  const slots = await getAvailableSlots(date, duration);
  return NextResponse.json({ slots });
}
