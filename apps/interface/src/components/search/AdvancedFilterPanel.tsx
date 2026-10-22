"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Input } from "@fund-my-cause/components";
import {
  FORM_FIELD_CLS,
  FORM_INPUT_CLS_COMPACT,
  FORM_LABEL_CLS_XS,
} from "@/lib/formStyles";
import type { SearchFilters } from "@/services/search.service";

interface AdvancedFilterPanelProps {
  filters: SearchFilters;
  onApplyAdvanced: (values: {
    goalMin: string;
    goalMax: string;
    dateFrom: string;
    dateTo: string;
  }) => void;
  onClearAdvanced: () => void;
  onToggleAdvanced: () => void;
}

const filterFieldStyles = {
  unstyled: true as const,
  className: FORM_INPUT_CLS_COMPACT,
  fieldClassName: FORM_FIELD_CLS,
  labelClassName: FORM_LABEL_CLS_XS,
};

export function AdvancedFilterPanel({
  filters,
  onApplyAdvanced,
  onClearAdvanced,
  onToggleAdvanced,
}: AdvancedFilterPanelProps) {
  const [goalMin, setGoalMin] = useState(
    filters.goalMin !== undefined ? String(filters.goalMin) : "",
  );
  const [goalMax, setGoalMax] = useState(
    filters.goalMax !== undefined ? String(filters.goalMax) : "",
  );
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");

  useEffect(() => {
    setGoalMin(filters.goalMin !== undefined ? String(filters.goalMin) : "");
    setGoalMax(filters.goalMax !== undefined ? String(filters.goalMax) : "");
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
  }, [filters.goalMin, filters.goalMax, filters.dateFrom, filters.dateTo]);

  function handleApply() {
    onApplyAdvanced({ goalMin, goalMax, dateFrom, dateTo });
    onToggleAdvanced();
  }

  function handleClear() {
    setGoalMin("");
    setGoalMax("");
    setDateFrom("");
    setDateTo("");
    onClearAdvanced();
  }

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">
          Advanced Filters
        </h3>
        <span className="flex items-center gap-1 text-xs text-indigo-400">
          <Sparkles size={12} />
          Semantic search active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          {...filterFieldStyles}
          label="Min Goal (XLM)"
          type="number"
          min={0}
          value={goalMin}
          onChange={(e) => setGoalMin(e.target.value)}
          placeholder="e.g. 1000"
        />
        <Input
          {...filterFieldStyles}
          label="Max Goal (XLM)"
          type="number"
          min={0}
          value={goalMax}
          onChange={(e) => setGoalMax(e.target.value)}
          placeholder="e.g. 50000"
        />
        <Input
          {...filterFieldStyles}
          label="Deadline From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          {...filterFieldStyles}
          label="Deadline To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={handleClear}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
        >
          <X size={12} /> Clear
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
