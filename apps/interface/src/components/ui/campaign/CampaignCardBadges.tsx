"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { getCategoryBySlug } from "@/lib/categories";

export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: "funded" | "ended";
  label: string;
}) {
  const icon = status === "funded" ? "✓" : "⏰";
  return (
    <span
      className={cn(
        "absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold",
        status === "funded"
          ? "bg-[var(--color-success)]/90 text-white"
          : "bg-[var(--color-surface-elevated)]/90 text-[var(--color-text-secondary)]",
      )}
    >
      <span aria-hidden="true" className="mr-1">
        {icon}
      </span>
      {label}
    </span>
  );
}

export function CategoryBadge({ slug }: { slug?: string }) {
  const cat = getCategoryBySlug(slug);
  if (!cat) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
      title={cat.label}
    >
      <span aria-hidden="true">{cat.emoji}</span>
      <span>{cat.label}</span>
    </span>
  );
}
