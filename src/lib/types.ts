export type Lang = "en" | "fr" | "es";

export type ResidenceType = "residential" | "comercial" | "airbnb";
export type ServiceType = "standard" | "deep" | "move_in_out" | "general" | "addons";
export type Frequency = "one_time" | "monthly" | "biweekly" | "weekly";

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded";

export interface ServiceItem {
  id: number;
  type: ServiceType;
  category: string | null;
  code: string;
  name_en: string;
  name_fr: string;
  name_es: string;
  estimated_hours: number;
  price_per_hour: number;
  flat_price: number | null;
  is_request_quote: boolean;
  active: boolean;
  sort_order: number;
}

/** Una línea seleccionada en el cotizador (servicio base o add-on) */
export interface SelectedLine {
  code: string;
  name: string;
  hours: number;
  flat_price: number | null;
  is_request_quote: boolean;
  qty: number;
  line_total: number;
}

export interface QuoteInput {
  residenceType: ResidenceType;
  serviceType: ServiceType;
  roomsFactor: number;
  isFirstService: boolean;
  frequency: Frequency;
  services: SelectedLine[];
  addons: SelectedLine[];
}

export interface QuoteBreakdown {
  coreTotal: number;
  addonsTotal: number;
  subtotal: number;
  discountRate: number;
  firstServiceDiscount: number;
  frequencyDiscount: number;
  discountAmount: number;
  total: number;
  totalHours: number;      // horas-hombre (base del precio)
  durationHours: number;   // horas reales en sitio (totalHours / tamaño de equipo)
  crewSize: number;
  hasRequestQuote: boolean;
  payment40: number;
  payment60: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  language: Lang;
  created_at: string;
}

export interface Cleaner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive";
  hire_date: string | null;
  avatar_url: string | null;
}

export interface Booking {
  id: string;
  quote_id: string | null;
  client_id: string | null;
  cleaner_id: number | null;
  service_date: string;
  service_time: string;
  duration_hours: number;
  address: string | null;
  status: BookingStatus;
  payment_40_intent_id: string | null;
  payment_40_amount: number | null;
  payment_40_status: PaymentStatus;
  payment_60_intent_id: string | null;
  payment_60_amount: number | null;
  payment_60_status: PaymentStatus;
  google_calendar_event_id: string | null;
  notes: string | null;
  created_at: string;
}
