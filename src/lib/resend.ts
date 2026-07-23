import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

const FROM = () => process.env.RESEND_FROM_EMAIL || "Aura Cleaners <onboarding@resend.dev>";

export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("[resend] RESEND_API_KEY ausente; email omitido:", input.subject);
      return false;
    }
    await getResend().emails.send({
      from: FROM(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    return true;
  } catch (err) {
    console.error("[resend] sendEmail error:", err);
    return false;
  }
}

export const ADMIN_EMAIL = () =>
  process.env.ADMIN_NOTIFICATION_EMAIL || "info@auracleaners.ca";
