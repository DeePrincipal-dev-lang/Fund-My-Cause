"use client";

/**
 * CampaignsView — pure presentational component for the campaigns list page.
 *
 * Receives all data and callbacks as props. Contains zero state, zero hooks,
 * and zero side-effects. This makes it independently testable and renderable
 * from Storybook without any routing or context setup.
 *
 * Issue #1350: split CampaignsInner into container + presentational components.
 */

import React from "react";
import Link from "next/link";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { ShareModal } from "@/components/ui/ShareModal";
import {
  EmptyState,
  NoCampaignsIllustration,
} from "@/components/ui/EmptyState";
import { Campaign } from "@/types/campaign";
import { Search, GitCompare, SlidersHorizontal, X } from "lucide-react";
import type { FilterTab, SortOption } from "@/hooks/useCampaignFilters";
import { Suspense } from "react";
import { LazyPledgeModal as PledgeModal } from "@/lib/lazy-components";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterTabDef {
  label: string;
  value: FilterTab;
}

export interface CampaignFilters {
  filter: FilterTab;
  sort: SortOption;
  category: string;
  query: string;
  page: number;
  goalMin: string;
  goalMax: string;
  dateFrom: string;
  dateTo: string;
}

export interface CampaignsViewProps {
  // Data
  paginated: Campaign[];
  filtered: Campaign[];
  categories: string[];
  filters: CampaignFilters;
  filterTabs: FilterTabDef[];
  inputValue: string;
  showAdvanced: boolean;
  hasAdvanced: boolean;
  currentPage: number;
  totalPages: number;

  // Comparison bar
  selectedCount: number;

  // Modal state
  pledge: string | null;
  pledgeTitle: string;
  shareTarget: { id: string; title: string } | null;

  // Callbacks — filter controls
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onFilterTabChange: (value: FilterTab) => void;
  onToggleAdvanced: () => void;
  onGoalMinChange: (value: string) => void;
  onGoalMaxChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyAdvanced: () => void;
  onClearAdvanced: () => void;
  onClearFilters: () => void;

  // Callbacks — pagination
  onPageChange: (page: number) => void;

  // Callbacks — cards
  onPledge: (id: string) => void;
  onShare: (id: string, title: string) => void;
  onClosePledge: () => void;
  onCloseShare: () => void;

  // Callbacks — comparison bar
  onClearComparison: () => void;

  // i18n strings
  t: (key: string, opts?: Record<string, unknown>) => string;
}

// ── CSS helpers ───────────────────────────────────────────────────────────────

const selectCls =
  "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500";

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignsView({
  paginated,
  filtered,
  categories,
  filters,
  filterTabs,
  inputValue,
  showAdvanced,
  hasAdvanced,
  currentPage,
  totalPages,
  selectedCount,
  pledge,
  pledgeTitle,
  shareTarget,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onFilterTabChange,
  onToggleAdvanced,
  onGoalMinChange,
  onGoalMaxChange,
  onDateFromChange,
  onDateToChange,
  onApplyAdvanced,
  onClearAdvanced,
  onClearFilters,
  onPageChange,
  onPledge,
  onShare,
  onClosePledge,
  onCloseShare,
  onClearComparison,
  t,
}: CampaignsViewProps) {
  return (
    <>
      {/* ── Search + controls row ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={inputValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={t("searchPlaceholder")}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={filters.category}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Filter by category"
          className={selectCls}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort campaigns"
          className={selectCls}
        >
          <option value="recent">{t("sortNewest")}</option>
          <option value="popular">Most Popular</option>
          <option value="deadline">Deadline</option>
          <option value="progress">{t("sortMostFunded")}</option>
        </select>

        {/* Advanced filters toggle */}
        <button
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition border ${
            hasAdvanced
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-500"
          }`}
        >
          <SlidersHorizontal size={14} />
          Filters{hasAdvanced ? " ●" : ""}
        </button>
      </div>

      {/* ── Advanced filter panel ── */}
      {showAdvanced && (
        <div className="mb-4 rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">
            Advanced Filters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Min Goal (XLM)
              </label>
              <input
                type="number"
                min={0}
                value={filters.goalMin}
                onChange={(e) => onGoalMinChange(e.target.value)}
                placeholder="e.g. 1000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Max Goal (XLM)
              </label>
              <input
                type="number"
                min={0}
                value={filters.goalMax}
                onChange={(e) => onGoalMaxChange(e.target.value)}
                placeholder="e.g. 50000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Deadline From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Deadline To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClearAdvanced}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
            >
              <X size={12} /> Clear
            </button>
            <button
              onClick={onApplyAdvanced}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div
        className="flex gap-2 mb-8"
        role="tablist"
        aria-label={t("filterLabel")}
      >
        {filterTabs.map((tab, idx) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={filters.filter === tab.value}
            tabIndex={filters.filter === tab.value ? 0 : -1}
            onClick={() => onFilterTabChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const next = filterTabs[(idx + 1) % filterTabs.length];
                onFilterTabChange(next.value);
                (
                  e.currentTarget.parentElement?.children[
                    (idx + 1) % filterTabs.length
                  ] as HTMLElement
                )?.focus();
              } else if (e.key === "ArrowLeft") {
                const prev =
                  filterTabs[
                    (idx - 1 + filterTabs.length) % filterTabs.length
                  ];
                onFilterTabChange(prev.value);
                (
                  e.currentTarget.parentElement?.children[
                    (idx - 1 + filterTabs.length) % filterTabs.length
                  ] as HTMLElement
                )?.focus();
              }
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filters.filter === tab.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Campaign grid / empty state ── */}
      {filtered.length === 0 ? (
        <EmptyState
          illustration={<NoCampaignsIllustration />}
          title={t("noResults")}
          description={t("noResultsDesc")}
          action={{
            label: t("clearFilters"),
            onClick: onClearFilters,
          }}
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {filtered.length === 1
              ? t("found", { count: 1 })
              : t("foundPlural", { count: filtered.length })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paginated.map((campaign, i) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onPledge={onPledge}
                onShare={onShare}
                index={i}
                query={filters.query}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
              >
                {t("previous")}
              </button>
              <span className="text-sm text-gray-400">
                {t("page", { current: currentPage, total: totalPages })}
              </span>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {pledge && (
        <Suspense fallback={null}>
          <PledgeModal
            contractId={pledge}
            campaignTitle={pledgeTitle}
            onClose={onClosePledge}
          />
        </Suspense>
      )}

      {shareTarget && (
        <ShareModal
          campaignId={shareTarget.id}
          campaignTitle={shareTarget.title}
          onClose={onCloseShare}
        />
      )}

      {/* ── Comparison bar ── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 shadow-2xl">
          <GitCompare size={16} className="text-indigo-400" />
          <span className="text-sm text-gray-300">
            {t("selected", { count: selectedCount })}
          </span>
          <Link
            href="/compare"
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition"
          >
            {t("compare")}
          </Link>
          <button
            onClick={onClearComparison}
            className="text-gray-500 hover:text-gray-300 text-xs transition"
          >
            {t("clear")}
          </button>
        </div>
      )}
    </>
  );
}
