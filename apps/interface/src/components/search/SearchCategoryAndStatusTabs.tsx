"use client";

import React from "react";
import { CATEGORY_TAXONOMY } from "@/lib/categories";
import type { SearchFilters } from "@/services/search.service";

export const FILTER_TABS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Funded", value: "funded" },
  { label: "Ended", value: "ended" },
];

interface SearchCategoryAndStatusTabsProps {
  filters: SearchFilters;
  onFilterChange: (key: string, value: string) => void;
}

export function SearchCategoryAndStatusTabs({
  filters,
  onFilterChange,
}: SearchCategoryAndStatusTabsProps) {
  const currentStatus = filters.status ?? "all";

  return (
    <>
      {/* ── Category pills ────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by category"
      >
        <button
          onClick={() => onFilterChange("category", "")}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${
            !filters.category
              ? "bg-indigo-600 text-white"
              : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          All
        </button>
        {CATEGORY_TAXONOMY.map((cat) => (
          <button
            key={cat.slug}
            onClick={() =>
              onFilterChange(
                "category",
                filters.category === cat.slug ? "" : cat.slug,
              )
            }
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filters.category === cat.slug
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter by status"
      >
        {FILTER_TABS.map((tab, idx) => {
          const isSelected =
            currentStatus === tab.value ||
            (!filters.status && tab.value === "all");
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onFilterChange("filter", tab.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  const next = FILTER_TABS[(idx + 1) % FILTER_TABS.length];
                  onFilterChange("filter", next.value);
                  (
                    e.currentTarget.parentElement?.children[
                      (idx + 1) % FILTER_TABS.length
                    ] as HTMLElement
                  )?.focus();
                } else if (e.key === "ArrowLeft") {
                  const prev =
                    FILTER_TABS[
                      (idx - 1 + FILTER_TABS.length) % FILTER_TABS.length
                    ];
                  onFilterChange("filter", prev.value);
                  (
                    e.currentTarget.parentElement?.children[
                      (idx - 1 + FILTER_TABS.length) % FILTER_TABS.length
                    ] as HTMLElement
                  )?.focus();
                }
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                isSelected
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
