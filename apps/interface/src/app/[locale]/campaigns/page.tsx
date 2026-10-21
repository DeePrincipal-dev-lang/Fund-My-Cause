"use client";

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { LazyPledgeModal as PledgeModal } from "@/lib/lazy-components";
import { ShareModal } from "@/components/ui/ShareModal";
import { LoadingSkeletonGrid } from "@/components/ui/LoadingSkeleton";
import { Campaign } from "@/types/campaign";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { GitCompare } from "lucide-react";
import { useComparison } from "@/context/ComparisonContext";
import { useTranslations } from "next-intl";
import {
  useCampaignFilters,
  type FilterTab,
  type SortOption,
} from "@/hooks/useCampaignFilters";
import { CampaignFilters } from "@/components/campaigns/CampaignFilters";
import { CampaignList } from "@/components/campaigns/CampaignList";

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

function CampaignsContainer() {
  const router = useRouter();
  const { selected, clear } = useComparison();
  const t = useTranslations("campaigns");

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

  const [pledge, setPledge] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const FILTER_TABS: { label: string; value: FilterTab }[] = [
    { label: t("filterAll"), value: "all" },
    { label: t("filterActive"), value: "active" },
    { label: t("filterFunded"), value: "funded" },
    { label: t("filterEnded"), value: "ended" },
  ];

  const setPage = (p: number) => {
    const params = new URLSearchParams();
    if (p !== 1) params.set("page", String(p));
    if (filters.filter !== "all") params.set("filter", filters.filter);
    if (filters.sort !== "recent") params.set("sort", filters.sort);
    if (filters.category) params.set("category", filters.category);
    if (filters.query) params.set("q", filters.query);
    router.replace(`/campaigns?${params.toString()}`, { scroll: false });
  };

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

  return (
    <>
      <CampaignFilters
        activeFilter={filters.filter}
        activeSort={filters.sort}
        searchQuery={inputValue}
        filterTabs={FILTER_TABS}
        categories={CATEGORIES}
        activeCategory={filters.category}
        showAdvanced={showAdvanced}
        hasAdvanced={hasAdvanced}
        goalMin={filters.goalMin}
        goalMax={filters.goalMax}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onFilterChange={(value) => setParam("filter", value)}
        onSortChange={(value) => setParam("sort", value)}
        onSearchChange={setInputValue}
        onCategoryChange={(value) => setParam("category", value)}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        onGoalMinChange={setGoalMin}
        onGoalMaxChange={setGoalMax}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApplyAdvanced={applyAdvanced}
        onClearAdvanced={clearAdvanced}
        sortLabels={{
          recent: t("sortNewest"),
          popular: "Most Popular",
          deadline: "Deadline",
          progress: t("sortMostFunded"),
        }}
        searchPlaceholder={t("searchPlaceholder")}
      />

      {filtered.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          {filtered.length === 1
            ? t("found", { count: 1 })
            : t("foundPlural", { count: filtered.length })}
        </p>
      )}

      <CampaignList
        campaigns={paginated}
        onPledge={(id) => setPledge(id)}
        onShare={(id, title) => setShareTarget({ id, title })}
        isEmpty={filtered.length === 0}
        emptyStateTitle={t("noResults")}
        emptyStateDescription={t("noResultsDesc")}
        emptyStateAction={{
          label: t("clearFilters"),
          onClick: () => router.replace("/campaigns"),
        }}
        query={filters.query}
      />

      {totalPages > 1 && filtered.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
          >
            {t("previous")}
          </button>
          <span className="text-sm text-gray-400">
            {t("page", { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
          >
            {t("next")}
          </button>
        </div>
      )}

      {pledge && (
        <PledgeModal
          contractId={pledge}
          campaignTitle={
            ALL_CAMPAIGNS.find((c) => c.id === pledge)?.title ?? pledge
          }
          onClose={() => setPledge(null)}
        />
      )}

      {shareTarget && (
        <ShareModal
          campaignId={shareTarget.id}
          campaignTitle={shareTarget.title}
          onClose={() => setShareTarget(null)}
        />
      )}

      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 shadow-2xl">
          <GitCompare size={16} className="text-indigo-400" />
          <span className="text-sm text-gray-300">
            {t("selected", { count: selected.length })}
          </span>
          <Link
            href="/compare"
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition"
          >
            {t("compare")}
          </Link>
          <button
            onClick={clear}
            className="text-gray-500 hover:text-gray-300 text-xs transition"
          >
            {t("clear")}
          </button>
        </div>
      )}
    </>
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
