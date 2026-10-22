"use client";

import React, { useState } from "react";
import { FileText, FileJson, FileSpreadsheet } from "lucide-react";
import { CampaignData } from "@/types/soroban";

interface AnalyticsExportProps {
  campaigns: CampaignData[];
}

type ExportFormat = "csv" | "json" | "pdf";

export function AnalyticsExport({ campaigns }: AnalyticsExportProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const exportCsv = () => {
    const header = "Title,Status,Raised (XLM),Goal (XLM),Deadline,Contract ID,Contributors,Avg Contribution";
    const rows = campaigns.map((c) =>
      [
        `"${c.title.replace(/"/g, '""')}"`,
        c.status,
        c.raised.toFixed(2),
        c.goal.toFixed(2),
        new Date(c.deadline).toISOString().split("T")[0],
        c.contractId,
        c.contributorCount,
        c.averageContribution.toFixed(2),
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    downloadBlob(blob, "campaigns-analytics.csv");
  };

  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      totalCampaigns: campaigns.length,
      campaigns: campaigns.map((c) => ({
        title: c.title,
        status: c.status,
        raised: c.raised,
        goal: c.goal,
        deadline: c.deadline,
        contractId: c.contractId,
        contributorCount: c.contributorCount,
        averageContribution: c.averageContribution,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, "campaigns-analytics.json");
  };

  const exportPdf = () => {
    // Simple text-based PDF export (for a real implementation, use a library like jsPDF)
    const content = campaigns.map((c) => 
      `${c.title}\nStatus: ${c.status}\nRaised: ${c.raised.toFixed(2)} XLM\nGoal: ${c.goal.toFixed(2)} XLM\nContributors: ${c.contributorCount}\n\n`
    ).join("");
    
    const blob = new Blob([content], { type: "text/plain" });
    downloadBlob(blob, "campaigns-analytics.txt");
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: ExportFormat) => {
    setExporting(format);
    try {
      switch (format) {
        case "csv":
          exportCsv();
          break;
        case "json":
          exportJson();
          break;
        case "pdf":
          exportPdf();
          break;
      }
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Export:</span>
      <button
        onClick={() => handleExport("csv")}
        disabled={exporting !== null}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        title="Export as CSV"
      >
        <FileSpreadsheet size={16} />
        CSV
      </button>
      <button
        onClick={() => handleExport("json")}
        disabled={exporting !== null}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        title="Export as JSON"
      >
        <FileJson size={16} />
        JSON
      </button>
      <button
        onClick={() => handleExport("pdf")}
        disabled={exporting !== null}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        title="Export as text file"
      >
        <FileText size={16} />
        TXT
      </button>
    </div>
  );
}
