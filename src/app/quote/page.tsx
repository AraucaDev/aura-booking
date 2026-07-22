import { QuoteWizard } from "@/components/quote/QuoteWizard";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function QuotePage({
  searchParams,
}: {
  searchParams: { embed?: string; lang?: string };
}) {
  const embed = searchParams?.embed === "1";
  const langParam = searchParams?.lang;
  const initialLang: Lang =
    langParam === "fr" || langParam === "es" ? langParam : "en";
  return <QuoteWizard embed={embed} initialLang={initialLang} />;
}
