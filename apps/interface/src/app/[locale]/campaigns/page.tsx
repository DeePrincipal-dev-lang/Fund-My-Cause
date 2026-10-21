"use client";

/**
 * Campaigns page (App Router).
 *
 * Issue #1350 — Split CampaignsInner into focused components:
 *
 *   CampaignsContainer  (this file, below)
 *     Owns all state, hooks, derived data, and event handlers.
 *     Contains zero JSX beyond passing props to CampaignsView.
 *
 *   CampaignsView  (src/components/campaigns/CampaignsView.tsx)
 *     Pure presentational component: receives data + callbacks via props,
 *     renders the UI, has no hooks and no state of its own.
 *
 * This separation makes the view independently testable and previewable in
 * Storybook without any routing, context, or data-fetching setup.
 */

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { LoadingSkeletonGrid } from "@/components/ui/LoadingSkeleton";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { useComparison } from "@/context/ComparisonContext";
import { useTranslations } from "next-intl";
import {
  useCampaignFilters,
  type FilterTab,
  type SortOption,
} from "@/hooks/useCampaignFilters";
import {
  CampaignsView,
  type FilterTabDef,
} from "@/components/campaigns/CampaignsView";
import type { Campaign } from "@/types/campaign";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(c: Campaign): FilterTab {
  const ended = new Date(c.deadline) < new Date();
  if (c.raised >= c.goal) return "funded";
  if (ended) return "ended";
  return "active";
}

function applyFilter(campaigns: Campaign[], filter: FilterTab): Campaign[] {
  if (filter === "all") return campaigns;
  return campaigns.filter((c) => getStatus(c) === filter);
}

function applySort(campaigns: Campaign[], sort: SortOption): Campaign[] {
  return [...campaigns].sort((a, b) => {
    if (sort === "popular")
      return (b.contributorCount ?? 0) - (a.contributorCount ?? 0);
    if (sort === "deadline")
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sort === "progress") return b.raised / b.goal - a.raised / a.goal;
    return Number(b.id) - Number(a.id);
  });
}

const CATEGORIES = Array.from(
  new Set(ALL_CAMPAIGNS.map((c) => c.category).filter(Boolean)),
) as string[];

const PAGE_SIZE = 9;

// ── Container ─────────────────────────────────────────────────────────────────

/**
 * CampaignsContainer
 *
 * All logic lives here: filtering, sorting, pagination, modal state, and URL
 * synchronisation. It renders nothing except `<CampaignsView>` with computed
 * props.
 */
function CampaignsContainer() {
  const router = useRouter();
  const { selected, clear } = useComparison();
  const t = useTranslations("campaigns");

  // ── Filter hook ────────────────────────────────────────────────────────────
  const {
    filters,
    setParam,
    setInputValue,
    setGoalMin,
    setGoalMax,
    setDateFrom,
    setDateTo,
    applyAdvanced,
    clearAdvanced,
    inputValue,
    showAdvanced,
    setShowAdvanced,
    hasAdvanced,
    activeGoalMin,
    activeGoalMax,
    activeDateFrom,
    activeDateTo,
  } = useCampaignFilters();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [pledge, setPledge] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = applySort(
    applyFilter(
      ALL_CAMPAIGNS.filter((c) => {
        if (filters.query) {
          const q = filters.query.toLowerCase();
          if (
            !c.title.toLowerCase().includes(q) &&
            !c.description.toLowerCase().includes(q) &&
            !c.creator.toLowerCase().includes(q)
          )
            return false;
        }
        if (filters.category && c.category !== filters.category) return false;
        if (activeGoalMin !== null && c.goal < activeGoalMin) return false;
        if (activeGoalMax !== null && c.goal > activeGoalMax) return false;
        if (activeDateFrom && new Date(c.deadline) < new Date(activeDateFrom))
          return false;
        if (activeDateTo && new Date(c.deadline) > new Date(activeDateTo))
          return false;
        return true;
      }),
      filters.filter,
    ),
    filters.sort,
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // ── i18n tab definitions ───────────────────────────────────────────────────
  const filterTabs: FilterTabDef[] = [
    { label: t("filterAll"), value: "all" },
    { label: t("filterActive"), value: "active" },
    { label: t("filterFunded"), value: "funded" },
    { label: t("filterEnded"), value: "ended" },
  ];

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handlePageChange = (p: number) => {
    const params = new URLSearchParams();
    if (p !== 1) params.set("page", String(p));
    if (filters.filter !== "all") params.set("filter", filters.filter);
    if (filters.sort !== "recent") params.set("sort", filters.sort);
    if (filters.category) params.set("category", filters.category);
    if (filters.query) params.set("q", filters.query);
    router.replace(`/campaigns?${params.toString()}`, { scroll: false });
  };

  const pledgeTitle =
    ALL_CAMPAIGNS.find((c) => c.id === pledge)?.title ?? pledge ?? "";

  return (
    <CampaignsView
      // Data
      paginated={paginated}
      filtered={filtered}
      categories={CATEGORIES}
      filters={filters}
      filterTabs={filterTabs}
      inputValue={inputValue}
      showAdvanced={showAdvanced}
      hasAdvanced={hasAdvanced}
      currentPage={currentPage}
      totalPages={totalPages}
      // Comparison bar
      selectedCount={selected.length}
      // Modal state
      pledge={pledge}
      pledgeTitle={pledgeTitle}
      shareTarget={shareTarget}
      // Filter callbacks
      onSearchChange={setInputValue}
      onCategoryChange={(v) => setParam("category", v)}
      onSortChange={(v) => setParam("sort", v)}
      onFilterTabChange={(v) => setParam("filter", v)}
      onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
      onGoalMinChange={setGoalMin}
      onGoalMaxChange={setGoalMax}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onApplyAdvanced={applyAdvanced}
      onClearAdvanced={clearAdvanced}
      onClearFilters={() => router.replace("/campaigns")}
      // Pagination
      onPageChange={handlePageChange}
      // Card callbacks
      onPledge={(id) => setPledge(id)}
      onShare={(id, title) => setShareTarget({ id, title })}
      onClosePledge={() => setPledge(null)}
      onCloseShare={() => setShareTarget(null)}
      // Comparison bar
      onClearComparison={clear}
      // i18n
      t={t}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>
        <Suspense fallback={<LoadingSkeletonGrid count={6} />}>
          <CampaignsContainer />
        </Suspense>
      </div>
    </main>
  );
}
