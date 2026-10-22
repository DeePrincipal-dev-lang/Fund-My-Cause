"use client";

import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { SearchSuggestions } from "@/components/ui/SearchSuggestions";
import { SavedSearchManager } from "@/components/search/SavedSearchManager";
import type { SearchFilters } from "@/services/search.service";
import type { SearchSuggestion } from "@/hooks/useSearchSuggestions";
import type { SavedSearch } from "@/services/savedSearch.service";
import { Select } from "@fund-my-cause/components";
import { FORM_FIELD_CLS, FORM_SELECT_CLS_INLINE } from "@/lib/formStyles";
import { AdvancedFilterPanel } from "./AdvancedFilterPanel";
import {
  SearchCategoryAndStatusTabs,
  FILTER_TABS,
} from "./SearchCategoryAndStatusTabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  inputValue: string;
  onInputChange: (value: string) => void;
  filters: SearchFilters;
  onFilterChange: (key: string, value: string) => void;
  onApplyAdvanced: (values: {
    goalMin: string;
    goalMax: string;
    dateFrom: string;
    dateTo: string;
  }) => void;
  onClearAdvanced: () => void;
  onClearAll: () => void;
  suggestions: Array<{ id: string; title: string; category?: string }>;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  hasActiveFilters: boolean;
  recentSearches?: string[];
  /** Called when user wants to clear only the search query */
  onClearSearch: () => void;
  /** Saved searches for the current wallet. */
  savedSearches?: SavedSearch[];
  /** Persist the current filters under a name. */
  onSaveSearch?: (name: string) => void;
  /** Restore a saved search's filters. */
  onRestoreSearch?: (filters: SearchFilters) => void;
  /** Delete a saved search. */
  onDeleteSearch?: (id: string) => void;
  /** Rename a saved search. */
  onRenameSearch?: (id: string, name: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { label: "Newest", value: "recent" },
  { label: "Relevance", value: "relevance" },
  { label: "Most Funded", value: "most-funded" },
  { label: "Ending Soon", value: "ending-soon" },
  { label: "Trending", value: "trending" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AdvancedSearch({
  inputValue,
  onInputChange,
  filters,
  onFilterChange,
  onApplyAdvanced,
  onClearAdvanced,
  onClearAll,
  onClearSearch,
  suggestions,
  showAdvanced,
  onToggleAdvanced,
  hasActiveFilters,
  recentSearches = [],
  savedSearches = [],
  onSaveSearch,
  onRestoreSearch,
  onDeleteSearch,
  onRenameSearch,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const hasQuery = inputValue.trim().length > 0;
  const hasAdvancedFilters = !!(
    filters.goalMin !== undefined ||
    filters.goalMax !== undefined ||
    filters.dateFrom ||
    filters.dateTo
  );
  const currentStatus = filters.status ?? "all";

  function handleSuggestionSelect(s: SearchSuggestion) {
    onInputChange(s.title);
    setDropdownOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="space-y-4">
      {/* ── Search bar row ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
              setActiveIndex(-1);
              setDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, -1));
              } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                const s = suggestions[activeIndex];
                if (s) handleSuggestionSelect(s);
              } else if (e.key === "Escape") {
                setDropdownOpen(false);
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) setDropdownOpen(true);
            }}
            aria-label="Search campaigns"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen && suggestions.length > 0}
            aria-haspopup="listbox"
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-10 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />

          {/* X icon button for quick clear */}
          {hasQuery && (
            <button
              onClick={() => {
                onClearSearch();
                setDropdownOpen(false);
              }}
              aria-label="Clear search input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
            >
              <X size={14} />
            </button>
          )}

          <SearchSuggestions
            suggestions={suggestions}
            isOpen={dropdownOpen && suggestions.length > 0}
            onSelect={handleSuggestionSelect}
            onClose={() => setDropdownOpen(false)}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
          />
        </div>

        {/* Sort selector */}
        <Select
          unstyled
          className={FORM_SELECT_CLS_INLINE}
          fieldClassName={FORM_FIELD_CLS}
          value={filters.sort ?? "recent"}
          onChange={(e) => onFilterChange("sort", e.target.value)}
          aria-label="Sort campaigns"
          options={SORT_OPTIONS}
        />

        {/* Mobile filters toggle */}
        <button
          onClick={() => setShowMobileFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-500 sm:hidden"
        >
          <SlidersHorizontal size={14} />
          Filters &amp; Sort
        </button>

        {/* Advanced filters toggle */}
        <button
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition border hidden sm:flex ${
            hasAdvancedFilters
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-500"
          }`}
        >
          <SlidersHorizontal size={14} />
          Filters{hasAdvancedFilters ? " ●" : ""}
        </button>

        {/* Clear search (text button, visible when query is active) */}
        {hasQuery && (
          <button
            onClick={onClearSearch}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition"
          >
            Clear search
          </button>
        )}

        {/* Clear all (visible when non-search filters are active without a query) */}
        {!hasQuery && hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Recent searches ───────────────────────────────────────────────── */}
      {!hasQuery && recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500">Recent:</span>
          {recentSearches.slice(0, 5).map((q) => (
            <button
              key={q}
              onClick={() => onInputChange(q)}
              className="px-2.5 py-1 rounded-lg text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile filters panel ──────────────────────────────────────────── */}
      {showMobileFilters && (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-4 sm:hidden">
          <h3 className="text-sm font-semibold text-gray-300">
            Filter by Status
          </h3>
          <div className="flex flex-col gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  onFilterChange("filter", tab.value);
                  setShowMobileFilters(false);
                }}
                className={`w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition ${
                  currentStatus === tab.value
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Advanced filter panel ─────────────────────────────────────────── */}
      {showAdvanced && (
        <AdvancedFilterPanel
          filters={filters}
          onApplyAdvanced={onApplyAdvanced}
          onClearAdvanced={onClearAdvanced}
          onToggleAdvanced={onToggleAdvanced}
        />
      )}

      {/* ── Saved searches panel ─────────────────────────────────────────── */}
      {onSaveSearch && (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-300">
            Saved Searches
          </h3>
          <SavedSearchManager
            savedSearches={savedSearches}
            onRestore={onRestoreSearch ?? (() => {})}
            onDelete={onDeleteSearch ?? (() => {})}
            onRename={onRenameSearch ?? (() => {})}
            onSaveCurrent={onSaveSearch}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}

      <SearchCategoryAndStatusTabs
        filters={filters}
        onFilterChange={onFilterChange}
      />
    </div>
  );
}
