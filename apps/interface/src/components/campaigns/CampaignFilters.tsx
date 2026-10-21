"use client";

import React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterTab, SortOption } from "@/hooks/useCampaignFilters";

export interface FilterTabItem {
  label: string;
  value: FilterTab;
}

export interface CampaignFiltersProps {
  /** Current active status filter */
  activeFilter: FilterTab;
  /** Current active sort option */
  activeSort: SortOption;
  /** Current search input value (live, before debounce) */
  searchQuery: string;
  /** Available filter tab definitions */
  filterTabs: FilterTabItem[];
  /** Available category options */
  categories: string[];
  /** Currently selected category */
  activeCategory: string;
  /** Whether the advanced filter panel is open */
  showAdvanced: boolean;
  /** Whether any advanced filters are currently applied */
  hasAdvanced: boolean;
  /** Advanced filter field values */
  goalMin: string;
  goalMax: string;
  dateFrom: string;
  dateTo: string;
  /** Callbacks */
  onFilterChange: (filter: FilterTab) => void;
  onSortChange: (sort: SortOption) => void;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onToggleAdvanced: () => void;
  onGoalMinChange: (value: string) => void;
  onGoalMaxChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyAdvanced: () => void;
  onClearAdvanced: () => void;
  /** Localised sort option labels */
  sortLabels: {
    recent: string;
    popular: string;
    deadline: string;
    progress: string;
  };
  /** Localised label for the search placeholder */
  searchPlaceholder: string;
}

const selectCls =
  "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500";

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

export function CampaignFilters({
  activeFilter,
  activeSort,
  searchQuery,
  filterTabs,
  categories,
  activeCategory,
  showAdvanced,
  hasAdvanced,
  goalMin,
  goalMax,
  dateFrom,
  dateTo,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onCategoryChange,
  onToggleAdvanced,
  onGoalMinChange,
  onGoalMaxChange,
  onDateFromChange,
  onDateToChange,
  onApplyAdvanced,
  onClearAdvanced,
  sortLabels,
  searchPlaceholder,
}: CampaignFiltersProps) {
  return (
    <>
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4" data-testid="campaign-filters">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchPlaceholder}
            data-testid="search-input"
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={activeCategory}
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
          value={activeSort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          aria-label="Sort campaigns"
          data-testid="sort-select"
          className={selectCls}
        >
          <option value="recent">{sortLabels.recent}</option>
          <option value="popular">{sortLabels.popular}</option>
          <option value="deadline">{sortLabels.deadline}</option>
          <option value="progress">{sortLabels.progress}</option>
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

      {/* Advanced filter panel */}
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
                value={goalMin}
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
                value={goalMax}
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
                value={dateFrom}
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
                value={dateTo}
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

      {/* Filter tabs */}
      <div
        className="flex gap-2 mb-8"
        role="tablist"
        aria-label="Filter campaigns"
        data-testid="filter-tabs"
      >
        {filterTabs.map((tab, idx) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeFilter === tab.value}
            tabIndex={activeFilter === tab.value ? 0 : -1}
            data-testid={`filter-${tab.value}`}
            onClick={() => onFilterChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const next = filterTabs[(idx + 1) % filterTabs.length];
                onFilterChange(next.value);
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
                onFilterChange(prev.value);
                (
                  e.currentTarget.parentElement?.children[
                    (idx - 1 + filterTabs.length) % filterTabs.length
                  ] as HTMLElement
                )?.focus();
              }
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              activeFilter === tab.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
