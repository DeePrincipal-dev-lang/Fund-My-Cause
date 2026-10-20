"use client";

import React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { fetchContribution, fetchAllCampaigns } from "@/lib/soroban";
import type { ContributionEntry } from "@/hooks/useContributions";

interface ContributionsSectionProps {
  address: string;
  /** How many contributions to show per page. Defaults to 10. */
  pageSize?: number;
}

/**
 * Displays all contributions made by the given address, sorted by date
 * descending, using the shared `useInfiniteList` hook for pagination.
 */
export function ContributionsSection({
  address,
  pageSize = 10,
}: ContributionsSectionProps) {
  const { items, sentinelRef, isLoading, hasMore, error, retry } =
    useInfiniteList<ContributionEntry>({
      fetcher: async (page) => {
        const campaigns = await fetchAllCampaigns();
        const results = await Promise.allSettled(
          campaigns.map(async (campaign) => {
            const amount = await fetchContribution(
              campaign.contractId,
              address,
            );
            return { campaign, amount };
          }),
        );

        const all: ContributionEntry[] = [];
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.amount > 0) {
            const { campaign, amount } = result.value;
            all.push({
              contractId: campaign.contractId,
              campaignTitle: campaign.title,
              amount,
              date: new Date(campaign.deadline).getTime(),
            });
          }
        }

        // Sort once then slice to the requested page.
        all.sort((a, b) => b.date - a.date);
        const start = (page - 1) * pageSize;
        const slice = all.slice(start, start + pageSize);
        return {
          items: slice,
          hasMore: start + pageSize < all.length,
        };
      },
    });

  return (
    <section
      aria-labelledby="profile-contributions-heading"
      className="space-y-3"
    >
      <h2 id="profile-contributions-heading" className="text-lg font-semibold">
        Contribution History
      </h2>

      {items.length === 0 && isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : error && items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/30 p-4">
          <p className="text-sm text-red-300 flex-1">{error.message}</p>
          <button
            onClick={retry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-800 hover:bg-red-700 text-white transition"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No contributions made yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((entry) => (
            <div
              key={`${entry.contractId}-${entry.date}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {entry.campaignTitle}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(entry.date).toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-semibold text-indigo-500 shrink-0">
                {entry.amount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                XLM
              </span>
            </div>
          ))}

          {/* Inline error for subsequent pages */}
          {error && items.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/30 p-3">
              <p className="text-xs text-red-300 flex-1">{error.message}</p>
              <button
                onClick={retry}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-800 hover:bg-red-700 text-white transition"
              >
                <RefreshCw size={10} />
                Retry
              </button>
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} aria-hidden="true" />

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <p className="text-center text-xs text-gray-500 py-2">
              All contributions loaded.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
