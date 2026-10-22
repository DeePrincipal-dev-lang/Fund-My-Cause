"use client";

import React from "react";
import { Braces, FileSpreadsheet, FileText, Receipt } from "lucide-react";

export type ExportFormat = "csv" | "json" | "pdf" | "tax";

export const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "csv",
    label: "CSV",
    description: "Spreadsheet-ready. Date, amount, contributor, status.",
    icon: <FileSpreadsheet size={18} />,
  },
  {
    id: "json",
    label: "JSON",
    description: "Machine-readable JSON array. Useful for integrations.",
    icon: <Braces size={18} />,
  },
  {
    id: "pdf",
    label: "PDF",
    description: "Print-ready report with summary. Opens browser print dialog.",
    icon: <FileText size={18} />,
  },
  {
    id: "tax",
    label: "Tax Report",
    description:
      "CSV formatted for crypto tax tools. Includes acquisition date and asset fields.",
    icon: <Receipt size={18} />,
  },
];

interface ExportFormatSelectorProps {
  format: ExportFormat;
  onFormatChange: (fmt: ExportFormat) => void;
}

export function ExportFormatSelector({
  format,
  onFormatChange,
}: ExportFormatSelectorProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Format
      </legend>
      <div className="space-y-2">
        {FORMAT_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
              format === opt.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <input
              type="radio"
              name="export-format"
              value={opt.id}
              checked={format === opt.id}
              onChange={() => onFormatChange(opt.id)}
              className="mt-0.5 accent-indigo-600"
            />
            <span
              className={`mt-0.5 ${format === opt.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}
              aria-hidden="true"
            >
              {opt.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {opt.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {opt.description}
              </p>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
