"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Campaign } from "@/types/campaign";
import {
  advancedSearch,
  getSearchSuggestions,
  getRecommendations,
  loadPreferences,
  savePreferences,
  recordSearch,
  recordCategoryView,
} from "@/services/search.service";
import type {
  SearchFilters,
  SearchResult,
  UserPreferences,
  SortOption,
  FilterStatus,
} from "@/services/search.service";

export type { SearchFilters, SearchResult, SortOption, FilterStatus };
export type { ScoredCampaign, SearchFacets } from "@/services/search.service";
export { useSavedSearches } from "@/hooks/useSavedSearches";
export type { SavedSearch } from "@/services/savedSearch.service";

const BASE_PATH = "/campaigns";

export function useAdvancedSearch(campaigns: Campaign[]) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL — recomputed whenever searchParams changes
  const filters: SearchFilters = useMemo(() => ({
    query: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? undefined,
    status: (searchParams.get("filter") as FilterStatus) ?? "all",
    goalMin: searchParams.get("goalMin")
      ? Number(searchParams.get("goalMin"))
      : undefined,
    goalMax: searchParams.get("goalMax")
      ? Number(searchParams.get("goalMax"))
      : undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    // Keep "recent" as-is — advancedSearch treats it as "newest"
    sort: (searchParams.get("sort") ?? "recent") as SortOption,
    page: Math.max(1, Number(searchParams.get("page") ?? "1")),
    pageSize: Math.max(1, Number(searchParams.get("pageSize") ?? "9")),
  }), [searchParams]);

  // Local controlled input value (debounced to URL)
  const [inputValue, setInputValue] = useState(filters.query ?? "");
  // User category preference state (persisted to localStorage)
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Track previous query to avoid recording the same search twice
  const prevQueryRef = useRef(filters.query ?? "");

  // Keep local input in sync when URL changes from outside (e.g. back/forward)
  useEffect(() => {
    setInputValue(filters.query ?? "");
  }, [filters.query]);

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      const shouldDelete =
        !value ||
        (key === "filter" && value === "all") ||
        (key === "sort" && value === "newest") ||
        (key === "page" && value === "1");
      if (shouldDelete) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset to page 1 on any filter change
      if (key !== "page") params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
    },
    [router, searchParams],
  );

  // Debounce: push input changes to URL after 300 ms
  useEffect(() => {
    const t = setTimeout(() => updateParam("q", inputValue), 300);
    return () => clearTimeout(t);
  }, [inputValue, updateParam]);

  // Record each new search query in preferences
  useEffect(() => {
    const q = filters.query ?? "";
    if (q && q !== prevQueryRef.current) {
      prevQueryRef.current = q;
      const updated = recordSearch(q, preferences);
      setPreferences(updated);
      savePreferences(updated);
    }
    // preferences omitted intentionally: query recording must execute strictly when query string changes
  }, [filters.query]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────

  // Use inputValue for query so results update immediately as the user types
  // while the URL debounce runs in the background for shareable links.
  // Computed directly (no useMemo) to avoid stale-closure issues in tests and
  // concurrent mode — the in-memory search is fast enough to run every render.
  const activeFilters: SearchFilters = { ...filters, query: inputValue.trim() };
  const searchResult = advancedSearch(campaigns, activeFilters, preferences);

  // Compute suggestions and recommendations directly — fast for in-memory data
  // and avoids stale-closure bugs from complex useMemo dependencies.
  const suggestions = getSearchSuggestions(campaigns, inputValue);
  const recommendations = getRecommendations(
    campaigns,
    preferences,
    searchResult.items.map((s) => s.campaign.id),
  );

  const hasActiveFilters = !!(
    inputValue.trim() ||
    filters.category ||
    (filters.status && filters.status !== "all") ||
    filters.goalMin !== undefined ||
    filters.goalMax !== undefined ||
    filters.dateFrom ||
    filters.dateTo
  );

  // Apply all advanced filter fields in a single URL update
  const applyAdvancedFilters = useCallback(
    (values: {
      goalMin: string;
      goalMax: string;
      dateFrom: string;
      dateTo: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.goalMin) params.set("goalMin", values.goalMin);
      else params.delete("goalMin");
      if (values.goalMax) params.set("goalMax", values.goalMax);
      else params.delete("goalMax");
      if (values.dateFrom) params.set("dateFrom", values.dateFrom);
      else params.delete("dateFrom");
      if (values.dateTo) params.set("dateTo", values.dateTo);
      else params.delete("dateTo");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
    },
    [searchParams, router],
  );

  const clearAdvancedFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("goalMin");
    params.delete("goalMax");
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
  }, [searchParams, router]);

  // Update a single filter, tracking category views for personalisation
  const setFilter = useCallback(
    (key: string, value: string) => {
      if (key === "category" && value) {
        const updated = recordCategoryView(value, preferences);
        setPreferences(updated);
        savePreferences(updated);
      }
      updateParam(key, value);
    },
    [preferences, updateParam],
  );

  const setPage = useCallback(
    (p: number) => updateParam("page", String(p)),
    [updateParam],
  );

  const setPageSize = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", String(size));
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
    },
    [searchParams, router],
  );

  const clearAll = useCallback(() => {
    setInputValue("");
    router.replace(BASE_PATH, { scroll: false });
  }, [router]);

  /** Restore a full filter set from a saved search. */
  const restoreFilters = useCallback(
    (f: SearchFilters) => {
      const params = new URLSearchParams();
      if (f.query) params.set("q", f.query);
      if (f.category) params.set("category", f.category);
      if (f.status && f.status !== "all") params.set("filter", f.status);
      if (f.goalMin !== undefined) params.set("goalMin", String(f.goalMin));
      if (f.goalMax !== undefined) params.set("goalMax", String(f.goalMax));
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.sort && f.sort !== "recent") params.set("sort", f.sort);
      if (f.query) setInputValue(f.query);
      const qs = params.toString();
      router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
    },
    [router],
  );

  // Clears only the search query, leaving other filters intact
  const clearSearch = useCallback(() => {
    setInputValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
  }, [searchParams, router]);

  return {
    filters,
    inputValue,
    setInputValue,
    searchResult,
    suggestions,
    recommendations,
    preferences,
    showAdvanced,
    setShowAdvanced,
    hasActiveFilters,
    setFilter,
    setPage,
    setPageSize,
    applyAdvancedFilters,
    clearAdvancedFilters,
    clearAll,
    clearSearch,
    restoreFilters,
  };
}
