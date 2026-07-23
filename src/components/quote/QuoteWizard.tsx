"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";
import { serviceName, t } from "@/lib/i18n";
import { buildLine, computeQuote, ROOMS_FACTOR } from "@/lib/pricing";
import type {
  Cleaner,
  Frequency,
  Lang,
  ResidenceType,
  ServiceItem,
  ServiceType,
} from "@/lib/types";
import { classNames, formatCAD } from "@/lib/utils";

const RESIDENCE_TYPES: ResidenceType[] = ["residential", "comercial", "airbnb"];
const SERVICE_TYPES: ServiceType[] = ["standard", "deep", "move_in_out", "general", "addons"];
const ROOM_KEYS = ["1-2", "3-4", "4+"] as const;
const FREQUENCIES: Frequency[] = ["one_time", "monthly", "biweekly", "weekly"];
const APPLY_ROOMS: ServiceType[] = ["standard", "deep", "move_in_out"];

type RoomKey = (typeof ROOM_KEYS)[number];

const TOTAL_STEPS = 12;

export function QuoteWizard({
  embed = false,
  initialLang = "en",
}: {
  embed?: boolean;
  initialLang?: Lang;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // selección
  const [residenceType, setResidenceType] = useState<ResidenceType | null>(null);
  const [isFirstService, setIsFirstService] = useState<boolean | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [roomKey, setRoomKey] = useState<RoomKey>("1-2");
  const [serviceQtys, setServiceQtys] = useState<Record<string, number>>({});
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<Frequency>("one_time");
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [cleanerId, setCleanerId] = useState<number | null>(null);

  // cliente + agenda
  const [client, setClient] = useState({ name: "", email: "", phone: "", address: "" });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | "request_quote">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: svc }, { data: cls }] = await Promise.all([
        supabase.from("services").select("*").eq("active", true).order("sort_order"),
        supabase.from("cleaners").select("*").eq("status", "active").order("name"),
      ]);
      setServices((svc as ServiceItem[]) ?? []);
      setCleaners((cls as Cleaner[]) ?? []);
      setLoadingServices(false);
    })();
  }, [supabase]);

  // Modo embebido: reportar la altura al sitio padre para auto-ajustar el iframe.
  useEffect(() => {
    if (!embed || typeof window === "undefined" || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "aura:resize", height: document.documentElement.scrollHeight },
        "*"
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    window.addEventListener("load", post);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
    };
  }, [embed]);

  const roomsFactor = ROOMS_FACTOR[roomKey];
  const coreServices = useMemo(
    () => services.filter((s) => s.type === serviceType),
    [services, serviceType]
  );
  const addonServices = useMemo(
    () => services.filter((s) => s.type === "addons"),
    [services]
  );
  const showAddonsStep = serviceType !== "addons";

  const selectedCleaner = useMemo(
    () => cleaners.find((c) => c.id === cleanerId) ?? null,
    [cleaners, cleanerId]
  );
  // Mientras no se elija profesional, se muestra la tarifa base del catálogo.
  const hourlyRate = selectedCleaner ? Number(selectedCleaner.hourly_rate) : undefined;

  const serviceLines = useMemo(() => {
    if (!serviceType) return [];
    const applyRooms = APPLY_ROOMS.includes(serviceType);
    return coreServices
      .filter((s) => (serviceQtys[s.code] || 0) > 0)
      .map((s) => ({
        ...buildLine(s, serviceQtys[s.code], roomsFactor, applyRooms, hourlyRate),
        item: s,
      }));
  }, [coreServices, serviceQtys, roomsFactor, serviceType, hourlyRate]);

  const addonLines = useMemo(() => {
    if (!showAddonsStep) return [];
    return addonServices
      .filter((s) => (addonQtys[s.code] || 0) > 0)
      .map((s) => ({
        ...buildLine(s, addonQtys[s.code], roomsFactor, false, hourlyRate),
        item: s,
      }));
  }, [addonServices, addonQtys, roomsFactor, showAddonsStep, hourlyRate]);

  const breakdown = useMemo(
    () =>
      computeQuote({
        residenceType: residenceType ?? "residential",
        serviceType: serviceType ?? "standard",
        roomsFactor,
        isFirstService: !!isFirstService,
        frequency,
        services: serviceLines,
        addons: addonLines,
      }),
    [residenceType, serviceType, roomsFactor, isFirstService, frequency, serviceLines, addonLines]
  );

  // Cargar slots al entrar al paso de fecha, o al cambiar fecha/cleaner.
  // La disponibilidad es propia de cada cleaner (agenda + 1h de traslado).
  useEffect(() => {
    if (step !== 11 || !date || !cleanerId) return;
    setLoadingSlots(true);
    setTime("");
    const dur = Math.max(1, Math.ceil(breakdown.durationHours || 1));
    fetch(`/api/availability?date=${date}&duration=${dur}&cleanerId=${cleanerId}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, date, cleanerId, breakdown.durationHours]);

  function setQty(map: "svc" | "add", code: string, delta: number) {
    const setter = map === "svc" ? setServiceQtys : setAddonQtys;
    setter((prev) => {
      const next = Math.max(0, (prev[code] || 0) + delta);
      return { ...prev, [code]: next };
    });
  }

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!residenceType;
      case 2:
        return isFirstService !== null;
      case 3:
        return !!serviceType;
      case 5:
        return serviceLines.length > 0;
      case 8:
        return !!cleanerId;
      case 10:
        return !!client.name && /.+@.+\..+/.test(client.email) && !!client.address;
      case 11:
        return !!date && !!time;
      default:
        return true;
    }
  }

  function goNext() {
    setError(null);
    let n = step + 1;
    if (n === 6 && !showAddonsStep) n = 7; // saltar add-ons si el servicio ES add-ons
    setStep(Math.min(n, TOTAL_STEPS));
  }
  function goBack() {
    setError(null);
    let p = step - 1;
    if (p === 6 && !showAddonsStep) p = 5;
    setStep(Math.max(p, 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        lang,
        cleanerId,
        residenceType,
        serviceType,
        roomKey,
        roomsFactor,
        isFirstService,
        frequency,
        services: serviceLines.map(({ item, ...l }) => l),
        addons: addonLines.map(({ item, ...l }) => l),
        client,
        date,
        time,
      };
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        // Alguien tomó el horario mientras el cliente completaba el formulario.
        if (res.status === 409 || data.slotTaken) {
          setError(data.error || t(lang, "slot_taken"));
          setTime("");
          setStep(11); // volver a elegir horario
          setSubmitting(false);
          return;
        }
        throw new Error(data.error || "Error");
      }

      if (data.requestQuote) {
        setDone("request_quote");
        return;
      }
      // Ir a Stripe Checkout
      const checkout = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.bookingId }),
      });
      const cdata = await checkout.json();
      if (!checkout.ok || !cdata.url) throw new Error(cdata.error || "Checkout error");
      // Embebido: Stripe Checkout no puede vivir dentro de un iframe, así que
      // pedimos al sitio padre que redirija a nivel superior. Si no, redirigimos aquí.
      if (embed && window.parent !== window) {
        window.parent.postMessage({ type: "aura:redirect", url: cdata.url }, "*");
      } else {
        window.location.href = cdata.url;
      }
    } catch (e: any) {
      setError(e.message || "Error");
      setSubmitting(false);
    }
  }

  if (done === "request_quote") {
    return (
      <Shell lang={lang} setLang={setLang} step={TOTAL_STEPS}>
        <div className="card text-center">
          <h2 className="font-display text-2xl text-aura-brown">{t(lang, "rq_title")}</h2>
          <p className="mt-3 text-aura-brown/70">{t(lang, "rq_body")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} setLang={setLang} step={step}>
      {loadingServices ? (
        <div className="card text-center text-aura-brown/60">{t(lang, "loading")}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card min-h-[360px]">
            {/* STEP 1 — Residencia */}
            {step === 1 && (
              <Section title={t(lang, "s1_title")} sub={t(lang, "s1_sub")}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {RESIDENCE_TYPES.map((rt) => (
                    <Choice
                      key={rt}
                      active={residenceType === rt}
                      onClick={() => setResidenceType(rt)}
                      label={t(lang, rt)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* STEP 2 — Primera visita */}
            {step === 2 && (
              <Section title={t(lang, "s2_title")} sub={t(lang, "s2_sub")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice active={isFirstService === true} onClick={() => setIsFirstService(true)} label={t(lang, "yes")} />
                  <Choice active={isFirstService === false} onClick={() => setIsFirstService(false)} label={t(lang, "no")} />
                </div>
              </Section>
            )}

            {/* STEP 3 — Tipo de servicio */}
            {step === 3 && (
              <Section title={t(lang, "s3_title")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SERVICE_TYPES.map((st) => (
                    <Choice
                      key={st}
                      active={serviceType === st}
                      onClick={() => {
                        setServiceType(st);
                        setServiceQtys({});
                      }}
                      label={t(lang, st)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* STEP 4 — Habitaciones */}
            {step === 4 && (
              <Section title={t(lang, "s4_title")}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {ROOM_KEYS.map((rk) => (
                    <Choice
                      key={rk}
                      active={roomKey === rk}
                      onClick={() => setRoomKey(rk)}
                      label={t(lang, rk === "1-2" ? "rooms_1_2" : rk === "3-4" ? "rooms_3_4" : "rooms_4p")}
                      hint={`×${ROOMS_FACTOR[rk]}`}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* STEP 5 — Servicios */}
            {step === 5 && (
              <Section title={t(lang, "s5_title")}>
                <QtyList
                  lang={lang}
                  items={coreServices}
                  qtys={serviceQtys}
                  onChange={(code, d) => setQty("svc", code, d)}
                />
              </Section>
            )}

            {/* STEP 6 — Add-ons */}
            {step === 6 && showAddonsStep && (
              <Section title={t(lang, "s6_title")}>
                <QtyList
                  lang={lang}
                  items={addonServices}
                  qtys={addonQtys}
                  onChange={(code, d) => setQty("add", code, d)}
                />
              </Section>
            )}

            {/* STEP 7 — Frecuencia */}
            {step === 7 && (
              <Section title={t(lang, "s7_title")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FREQUENCIES.map((f) => (
                    <Choice key={f} active={frequency === f} onClick={() => setFrequency(f)} label={t(lang, f)} />
                  ))}
                </div>
              </Section>
            )}

            {/* STEP 8 — Elegir profesional */}
            {step === 8 && (
              <Section title={t(lang, "s_cleaner_title")} sub={t(lang, "s_cleaner_sub")}>
                {cleaners.length === 0 ? (
                  <p className="text-aura-brown/60">{t(lang, "no_cleaners")}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cleaners.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCleanerId(c.id)}
                        className={classNames(
                          "option-card flex items-center gap-3",
                          cleanerId === c.id && "option-card-active"
                        )}
                      >
                        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-aura-sand bg-aura-cream">
                          {c.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatar_url} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-display text-xl text-aura-terracota">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-aura-brown">{c.name}</span>
                          <span className="block text-sm text-aura-terracota">
                            {formatCAD(Number(c.hourly_rate), lang)}
                            {t(lang, "per_hour")}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* STEP 9 — Estimado */}
            {step === 9 && (
              <Section title={t(lang, "s8_title")}>
                <Breakdown lang={lang} breakdown={breakdown} lines={[...serviceLines, ...addonLines]} />
              </Section>
            )}

            {/* STEP 10 — Datos cliente */}
            {step === 10 && (
              <Section title={t(lang, "s9_title")}>
                <div className="grid gap-3">
                  <input className="field" placeholder={t(lang, "full_name")} value={client.name}
                    onChange={(e) => setClient({ ...client, name: e.target.value })} />
                  <input className="field" type="email" placeholder={t(lang, "email")} value={client.email}
                    onChange={(e) => setClient({ ...client, email: e.target.value })} />
                  <input className="field" placeholder={t(lang, "phone")} value={client.phone}
                    onChange={(e) => setClient({ ...client, phone: e.target.value })} />
                  <input className="field" placeholder={t(lang, "address")} value={client.address}
                    onChange={(e) => setClient({ ...client, address: e.target.value })} />
                </div>
              </Section>
            )}

            {/* STEP 11 — Fecha y hora */}
            {step === 11 && (
              <Section title={t(lang, "s10_title")}>
                <input
                  type="date"
                  className="field mb-4"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                />
                {loadingSlots ? (
                  <p className="text-aura-brown/60">{t(lang, "loading")}</p>
                ) : date && slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setTime(s.time)}
                        className={classNames(
                          "rounded-xl border px-3 py-2 text-sm transition",
                          !s.available && "cursor-not-allowed border-transparent bg-aura-cream text-aura-brown/30 line-through",
                          s.available && time === s.time && "border-aura-brown bg-aura-brown text-aura-sand",
                          s.available && time !== s.time && "border-aura-terracota/40 text-aura-brown hover:border-aura-brown"
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                ) : date ? (
                  <p className="text-aura-brown/60">{t(lang, "no_slots")}</p>
                ) : null}
              </Section>
            )}

            {/* STEP 12 — Resumen */}
            {step === 12 && (
              <Section title={t(lang, "s11_title")}>
                <ReviewRow label={t(lang, "service")} value={t(lang, serviceType ?? "standard")} />
                <ReviewRow label={t(lang, "cleaner")} value={selectedCleaner?.name ?? "—"} />
                <ReviewRow label={t(lang, "frequency")} value={t(lang, frequency)} />
                <ReviewRow label={t(lang, "date")} value={date} />
                <ReviewRow label={t(lang, "time")} value={time} />
                <ReviewRow label={t(lang, "full_name")} value={client.name} />
                <ReviewRow label={t(lang, "address")} value={client.address} />
                <div className="my-4 border-t border-aura-terracota/20" />
                <Breakdown lang={lang} breakdown={breakdown} lines={[...serviceLines, ...addonLines]} />
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </Section>
            )}
          </div>

          {/* Sidebar: precio en vivo */}
          <aside className="card h-fit lg:sticky lg:top-6">
            <p className="text-xs uppercase tracking-widest text-aura-terracota">{t(lang, "total")}</p>
            <p className="font-display text-4xl font-semibold text-aura-brown">
              {breakdown.hasRequestQuote ? t(lang, "request_quote") : formatCAD(breakdown.total, lang)}
            </p>
            <div className="mt-3 space-y-1 text-sm text-aura-brown/70">
              <div className="flex justify-between"><span>{t(lang, "pay_now")}</span><span>{formatCAD(breakdown.payment40, lang)}</span></div>
              <div className="flex justify-between"><span>{t(lang, "pay_later")}</span><span>{formatCAD(breakdown.payment60, lang)}</span></div>
              <div className="flex justify-between"><span>{t(lang, "est_duration")}</span><span>{breakdown.durationHours} {t(lang, "hours")}</span></div>
              <div className="text-right text-xs text-aura-brown/40">{t(lang, "crew_note")}</div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {step < TOTAL_STEPS ? (
                <button className="btn-primary w-full disabled:opacity-40" disabled={!canProceed()} onClick={goNext}>
                  {t(lang, "continue")}
                </button>
              ) : (
                <button className="btn-primary w-full disabled:opacity-40" disabled={submitting || breakdown.hasRequestQuote} onClick={submit}>
                  {submitting ? t(lang, "processing") : breakdown.hasRequestQuote ? t(lang, "send_request") : t(lang, "reserve_pay")}
                </button>
              )}
              {step > 1 && (
                <button className="btn-outline w-full" onClick={goBack}>{t(lang, "back")}</button>
              )}
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────── */

function Shell({
  children,
  lang,
  setLang,
  step,
}: {
  children: React.ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
  step: number;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-display text-2xl font-semibold text-aura-brown">Aura Cleaners</p>
          <p className="text-xs uppercase tracking-[0.3em] text-aura-terracota">
            {t(lang, "step")} {step} {t(lang, "of")} {TOTAL_STEPS}
          </p>
        </div>
        <LanguageSelector lang={lang} onChange={setLang} />
      </header>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-aura-sand/40">
        <div className="h-full rounded-full bg-aura-brown transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      {children}
    </main>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-aura-brown">{title}</h2>
      {sub && <p className="mb-4 mt-1 text-sm text-aura-brown/60">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className={classNames("option-card", active && "option-card-active")}>
      <span className="block font-medium text-aura-brown">{label}</span>
      {hint && <span className="text-xs text-aura-terracota">{hint}</span>}
    </button>
  );
}

function QtyList({
  lang,
  items,
  qtys,
  onChange,
}: {
  lang: Lang;
  items: ServiceItem[];
  qtys: Record<string, number>;
  onChange: (code: string, delta: number) => void;
}) {
  return (
    <div className="divide-y divide-aura-terracota/15">
      {items.map((s) => (
        <div key={s.code} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-aura-brown">{serviceName(lang, s)}</p>
            <p className="text-xs text-aura-brown/50">
              {s.is_request_quote
                ? t(lang, "request_quote")
                : s.flat_price != null
                ? formatCAD(s.flat_price, lang)
                : `${s.estimated_hours} ${t(lang, "hours")}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="h-8 w-8 rounded-full border border-aura-terracota/40 text-aura-brown" onClick={() => onChange(s.code, -1)}>−</button>
            <span className="w-6 text-center font-medium">{qtys[s.code] || 0}</span>
            <button type="button" className="h-8 w-8 rounded-full border border-aura-terracota/40 text-aura-brown" onClick={() => onChange(s.code, 1)}>+</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Breakdown({
  lang,
  breakdown,
  lines,
}: {
  lang: Lang;
  breakdown: ReturnType<typeof computeQuote>;
  lines: { code: string; name: string; qty: number; line_total: number; is_request_quote: boolean }[];
}) {
  return (
    <div className="text-sm">
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.code} className="flex justify-between text-aura-brown/80">
            <span>{l.name} × {l.qty}</span>
            <span>{l.is_request_quote ? t(lang, "request_quote") : formatCAD(l.line_total, lang)}</span>
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-aura-terracota/20" />
      <Row label={t(lang, "subtotal")} value={formatCAD(breakdown.subtotal, lang)} />
      {breakdown.discountAmount > 0 && (
        <Row label={`${t(lang, "discount")} (${Math.round(breakdown.discountRate * 100)}%)`} value={`−${formatCAD(breakdown.discountAmount, lang)}`} />
      )}
      <Row label={t(lang, "total")} value={formatCAD(breakdown.total, lang)} bold />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={classNames("flex justify-between py-0.5", bold && "font-semibold text-aura-brown")}>
      <span className="text-aura-brown/70">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-aura-brown/60">{label}</span>
      <span className="font-medium text-aura-brown">{value}</span>
    </div>
  );
}
