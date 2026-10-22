"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function LanguageSelector() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Locale;
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    router.push(segments.join("/") || "/");
  };

  return (
    <div className="flex items-center gap-1">
      <Globe
        size={14}
        className="text-[var(--color-text-muted)] shrink-0"
        aria-hidden="true"
      />
      <select
        value={locale}
        onChange={handleChange}
        aria-label="Select language"
        className="bg-transparent text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc} className="bg-white dark:bg-gray-900">
            {localeNames[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
