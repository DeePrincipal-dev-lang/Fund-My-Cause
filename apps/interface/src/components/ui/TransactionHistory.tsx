"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, Loader2, Filter } from "lucide-react";
import {
  fetchTransactionHistory,
  type ContributionRecord,
} from "@/lib/graphql/client";
import {
  EmptyState,
  NoTransactionsIllustration,
} from "@/components/ui/EmptyState";
import { TransactionExportModal } from "@/components/ui/TransactionExportModal";
import { TransactionTable } from "@/components/ui/transaction/TransactionTable";
import { TransactionFilterPanel } from "@/components/ui/transaction/TransactionFilterPanel";
import {
  applyFilters,
  type ExportRecord,
  type DateRange,
} from "@/lib/exportTransactions";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contractId: string;
  /** Optional campaign title used in export filenames and PDF header. */
  campaignTitle?: string;
}

const network =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
const STELLAR_EXPERT = `https://stellar.expert/explorer/${network}`;

function toExportRecord(
  r: ContributionRecord,
  contractId: string,
  campaignTitle: string,
): ExportRecord {
  return {
    txHash: r.txHash,
    contributor: r.contributor,
    amountXlm: r.amountXlm,
    timestamp: r.timestamp,
    campaignId: contractId,
    campaignTitle,
    status: "Confirmed",
  };
}

export function TransactionHistory({
  contractId,
  campaignTitle = "Campaign",
}: Props) {
  const [records, setRecords] = useState<ContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [campaignFilter, setCampaignFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTransactionHistory(contractId, 0)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  const allExportRecords = useMemo(
    () => records.map((r) => toExportRecord(r, contractId, campaignTitle)),
    [records, contractId, campaignTitle],
  );

  const campaignIds = useMemo(
    () => Array.from(new Set(allExportRecords.map((r) => r.campaignId))),
    [allExportRecords],
  );

  const filteredRecords = useMemo(
    () =>
      applyFilters(allExportRecords, {
        dateRange,
        type: typeFilter,
        campaignId: campaignFilter,
      }),
    [allExportRecords, dateRange, typeFilter, campaignFilter],
  );

  const viewAllUrl = `${STELLAR_EXPERT}/contract/${contractId}`;
  const displayRecords = filteredRecords.slice(0, 10);
  const isFiltered =
    typeFilter !== "" ||
    dateRange.from !== "" ||
    dateRange.to !== "" ||
    campaignFilter !== "";

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Contributions
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Contributions
        </h2>
        <EmptyState
          illustration={<NoTransactionsIllustration />}
          title="No contributions yet"
          description="Be the first to pledge and help this campaign reach its goal."
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Recent Contributions
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v: boolean) => !v)}
              aria-label="Toggle filters"
              aria-pressed={showFilters}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isFiltered || showFilters
                  ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Filter size={12} />
              Filters{isFiltered ? " ●" : ""}
            </button>

            <button
              onClick={() => setShowExport(true)}
              aria-label="Export transaction history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-gray-100 dark:bg-gray-800
                text-gray-600 dark:text-gray-400
                hover:bg-gray-200 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-white
                transition"
            >
              <Download size={13} />
              Export
            </button>

            <a
              href={viewAllUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {showFilters && (
          <TransactionFilterPanel
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            campaignFilter={campaignFilter}
            onCampaignFilterChange={setCampaignFilter}
            campaignIds={campaignIds}
            isFiltered={isFiltered}
            onClearFilters={() => {
              setTypeFilter("");
              setDateRange({ from: "", to: "" });
              setCampaignFilter("");
            }}
          />
        )}

        {isFiltered && (
          <p
            className="text-xs text-gray-400 dark:text-gray-500"
            aria-live="polite"
          >
            Showing {filteredRecords.length} of {records.length} contributions
          </p>
        )}

        {/* Table */}
        <TransactionTable
          records={displayRecords}
          stellarExpertBaseUrl={STELLAR_EXPERT}
        />

        {filteredRecords.length > 10 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Showing 10 of {filteredRecords.length} contributions.{" "}
            <button
              onClick={() => setShowExport(true)}
              className="text-indigo-500 hover:underline"
            >
              Export all
            </button>
          </p>
        )}
      </div>

      {showExport && (
        <TransactionExportModal
          records={filteredRecords}
          campaignTitle={campaignTitle}
          campaignId={contractId}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
}
