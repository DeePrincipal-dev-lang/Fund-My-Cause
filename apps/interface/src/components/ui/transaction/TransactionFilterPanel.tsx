"use client";

import React from "react";
import type { DateRange } from "@/lib/exportTransactions";

interface TransactionFilterPanelProps {
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  campaignFilter: string;
  onCampaignFilterChange: (val: string) => void;
  campaignIds: string[];
  isFiltered: boolean;
  onClearFilters: () => void;
}

const inputCls =
  "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-500";

export function TransactionFilterPanel({
  typeFilter,
  onTypeFilterChange,
  dateRange,
  onDateRangeChange,
  campaignFilter,
  onCampaignFilterChange,
  campaignIds,
  isFiltered,
  onClearFilters,
}: TransactionFilterPanelProps) {
  return (
    <div className="flex flex-wrap gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className={inputCls}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, from: e.target.value })
          }
          className={inputCls}
          aria-label="Filter from date"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
        <input
          type="date"
          value={dateRange.to}
          min={dateRange.from || undefined}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, to: e.target.value })
          }
          className={inputCls}
          aria-label="Filter to date"
        />
      </div>

      {campaignIds.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Campaign
          </label>
          <select
            value={campaignFilter}
            onChange={(e) => onCampaignFilterChange(e.target.value)}
            className={inputCls}
            aria-label="Filter by campaign"
          >
            <option value="">All campaigns</option>
            {campaignIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </div>
      )}

      {isFiltered && (
        <button
          onClick={onClearFilters}
          className="self-end text-xs text-indigo-500 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
