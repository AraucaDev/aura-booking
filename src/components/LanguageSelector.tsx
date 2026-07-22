"use client";

import { LANGS } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { classNames } from "@/lib/utils";

export function LanguageSelector({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-aura-terracota/40 bg-white p-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => onChange(l.code)}
          className={classNames(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            lang === l.code
              ? "bg-aura-brown text-aura-sand"
              : "text-aura-brown/70 hover:text-aura-brown"
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
