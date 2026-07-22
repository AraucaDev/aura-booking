import type {
  Frequency,
  QuoteBreakdown,
  QuoteInput,
  SelectedLine,
  ServiceItem,
} from "./types";

export const BASE_RATE = 35; // CAD / hora

/** Factor por número de habitaciones */
export const ROOMS_FACTOR: Record<string, number> = {
  "1-2": 1,
  "3-4": 2,
  "4+": 2.5,
};

/** Descuento por recurrencia */
export const FREQUENCY_DISCOUNT: Record<Frequency, number> = {
  one_time: 0,
  monthly: 0.05,
  biweekly: 0.08,
  weekly: 0.1,
};

export const FIRST_SERVICE_DISCOUNT = 0.1;

/** Split de pagos */
export const PAYMENT_SPLIT = { first: 0.4, second: 0.6 };

/**
 * Tamaño del equipo por servicio. Las horas del catálogo son horas-hombre;
 * con un equipo de 2 personas el tiempo real en sitio es la mitad.
 * Solo afecta la agenda/calendario, NO el precio.
 */
export const CREW_SIZE = 2;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Convierte un servicio del catálogo + cantidad en una línea con su total.
 * - Precio fijo (flat_price): no aplica horas ni factor de habitaciones.
 * - Precio por hora: hours * qty * BASE_RATE, y el factor de habitaciones
 *   se aplica solo a los servicios base (no a los add-ons).
 */
export function buildLine(
  service: ServiceItem,
  qty: number,
  roomsFactor: number,
  applyRoomsFactor: boolean
): SelectedLine {
  let lineTotal = 0;
  if (service.is_request_quote) {
    lineTotal = 0;
  } else if (service.flat_price != null) {
    lineTotal = service.flat_price * qty;
  } else {
    const factor = applyRoomsFactor ? roomsFactor : 1;
    lineTotal = service.estimated_hours * qty * service.price_per_hour * factor;
  }
  return {
    code: service.code,
    name: service.name_en,
    hours: service.estimated_hours,
    flat_price: service.flat_price,
    is_request_quote: service.is_request_quote,
    qty,
    line_total: round2(lineTotal),
  };
}

/** Calcula el desglose completo de una cotización (autoridad de precios). */
export function computeQuote(input: QuoteInput): QuoteBreakdown {
  const { services, addons, roomsFactor, isFirstService, frequency } = input;

  const hasRequestQuote =
    services.some((s) => s.is_request_quote) ||
    addons.some((a) => a.is_request_quote);

  const coreTotal = round2(services.reduce((sum, s) => sum + s.line_total, 0));
  const addonsTotal = round2(addons.reduce((sum, a) => sum + a.line_total, 0));
  const subtotal = round2(coreTotal + addonsTotal);

  // Horas totales estimadas (para duración de la reserva y del evento de Calendar).
  const coreHours = services.reduce(
    (sum, s) => sum + s.hours * s.qty * (s.flat_price == null && !s.is_request_quote ? roomsFactor : 1),
    0
  );
  const addonHours = addons.reduce((sum, a) => sum + a.hours * a.qty, 0);
  const totalHours = round2(coreHours + addonHours);

  const firstServiceDiscount = isFirstService ? FIRST_SERVICE_DISCOUNT : 0;
  const frequencyDiscount = FREQUENCY_DISCOUNT[frequency] ?? 0;
  const discountRate = firstServiceDiscount + frequencyDiscount;
  const discountAmount = round2(subtotal * discountRate);
  const total = round2(subtotal - discountAmount);

  // Tiempo real en sitio: horas-hombre repartidas entre el equipo.
  const durationHours = round2(totalHours / CREW_SIZE);

  return {
    coreTotal,
    addonsTotal,
    subtotal,
    discountRate,
    firstServiceDiscount,
    frequencyDiscount,
    discountAmount,
    total,
    totalHours,
    durationHours,
    crewSize: CREW_SIZE,
    hasRequestQuote,
    payment40: round2(total * PAYMENT_SPLIT.first),
    payment60: round2(total * PAYMENT_SPLIT.second),
  };
}

/** Devuelve el monto en centavos para Stripe (CAD). */
export function toStripeAmount(cad: number): number {
  return Math.round(cad * 100);
}
