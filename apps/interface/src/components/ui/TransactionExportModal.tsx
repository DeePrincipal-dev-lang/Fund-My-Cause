"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  exportCsv,
  exportTaxReport,
  exportPdf,
  exportJson,
  filterByDateRange,
  ALL_COLUMNS,
  type ExportColumn,
  type ExportRecord,
  type DateRange,
} from "@/lib/exportTransactions";
import {
  ExportFormatSelector,
  type ExportFormat,
  FORMAT_OPTIONS,
} from "./export/ExportFormatSelector";
import { ExportColumnPicker } from "./export/ExportColumnPicker";

interface TransactionExportModalProps {
  records: ExportRecord[];
  campaignTitle: string;
  campaignId: string;
  onClose: () => void;
}

const inputCls =
  "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 " +
  "rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white " +
  "focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400";

export function TransactionExportModal({
  records,
  campaignTitle,
  campaignId,
  onClose,
}: TransactionExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<ExportColumn>>(
    new Set(ALL_COLUMNS),
  );

  const filteredRecords = useMemo(
    () => filterByDateRange(records, dateRange),
    [records, dateRange],
  );

  const slug = campaignTitle.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const dateTag = new Date().toISOString().slice(0, 10);
  const columns = ALL_COLUMNS.filter((c) => selectedColumns.has(c));

  const toggleColumn = (col: ExportColumn) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        if (next.size > 1) next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  };

  const showColumnPicker = format === "csv" || format === "json";

  const handleExport = async () => {
    if (filteredRecords.length === 0) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      if (format === "csv") {
        exportCsv(filteredRecords, `${slug}-transactions-${dateTag}.csv`, columns);
      } else if (format === "json") {
        exportJson(filteredRecords, `${slug}-transactions-${dateTag}.json`, columns);
      } else if (format === "tax") {
        exportTaxReport(filteredRecords, `${slug}-tax-report-${dateTag}.csv`);
      } else {
        exportPdf(filteredRecords, campaignTitle, campaignId);
      }
    } finally {
      setExporting(false);
    }
  };

  const isEmpty = filteredRecords.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Download
              size={18}
              className="text-indigo-500"
              aria-hidden="true"
            />
            <h2
              id="export-modal-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Export Transactions
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          <ExportFormatSelector format={format} onFormatChange={setFormat} />

          {showColumnPicker && (
            <ExportColumnPicker
              selectedColumns={selectedColumns}
              onToggleColumn={toggleColumn}
            />
          )}

          <fieldset>
            <legend className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              <Calendar size={12} aria-hidden="true" />
              Date Range (optional)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="export-from"
                  className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >
                  From
                </label>
                <input
                  id="export-from"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, from: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="export-to"
                  className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >
                  To
                </label>
                <input
                  id="export-to"
                  type="date"
                  value={dateRange.to}
                  min={dateRange.from || undefined}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, to: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </fieldset>

          <div
            className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
              isEmpty
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}
            aria-live="polite"
          >
            <span>
              {isEmpty
                ? "No transactions match the selected date range."
                : `${filteredRecords.length} transaction${filteredRecords.length !== 1 ? "s" : ""} will be exported`}
            </span>
            {!isEmpty && (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {filteredRecords
                  .reduce((s, r) => s + r.amountXlm, 0)
                  .toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                XLM total
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isEmpty || exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {exporting
              ? "Exporting…"
              : `Export ${FORMAT_OPTIONS.find((o) => o.id === format)?.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
