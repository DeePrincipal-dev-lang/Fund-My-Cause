"use client";

import React from "react";
import { ALL_COLUMNS, type ExportColumn } from "@/lib/exportTransactions";

export const COLUMN_LABELS: Record<ExportColumn, string> = {
  date: "Date",
  time: "Time (UTC)",
  txHash: "Tx Hash",
  contributor: "Contributor",
  campaign: "Campaign",
  campaignId: "Campaign ID",
  amountXlm: "Amount (XLM)",
  status: "Status",
};

interface ExportColumnPickerProps {
  selectedColumns: Set<ExportColumn>;
  onToggleColumn: (col: ExportColumn) => void;
}

export function ExportColumnPicker({
  selectedColumns,
  onToggleColumn,
}: ExportColumnPickerProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Columns
      </legend>
      <div className="flex flex-wrap gap-2">
        {ALL_COLUMNS.map((col) => (
          <label
            key={col}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition ${
              selectedColumns.has(col)
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedColumns.has(col)}
              onChange={() => onToggleColumn(col)}
              className="accent-indigo-600 w-3 h-3"
            />
            {COLUMN_LABELS[col]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
