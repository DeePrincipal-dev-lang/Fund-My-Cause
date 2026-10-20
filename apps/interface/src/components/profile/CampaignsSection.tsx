"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { fetchAllCampaigns } from "@/lib/soroban";
import { formatCampaignDateShort } from "@/lib/campaignDateFormatting";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type { CampaignData } from "@/lib/soroban";

interface CampaignsSectionProps {
  address: string;
  /** Called with the creator's campaigns once fetched, so parents can derive stats. */
  onCampaignsLoaded?: (campaigns: CampaignData[]) => void;
  /** Campaigns displayed per page. Defaults to 8. */
  pageSize?: number;
}

function CampaignCardRow({ campaign }: { campaign: CampaignData }) {
  const raisedXlm = campaign.raised;
  const goalXlm = campaign.goal;
  const progress = goalXlm > 0 ? Math.min(100, (raisedXlm / goalXlm) * 100) : 0;
  const deadline = formatCampaignDateShort(campaign.deadline);

  return (
    <Link
      href={`/campaigns/${campaign.contractId}`}
      className="block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-400 transition space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
          {campaign.title}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
          {campaign.status}
        </span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {raisedXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{" "}
          {goalXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
        </span>
        <span className="flex items-center gap-1">
          <ExternalLink size={10} />
          Deadline: {deadline}
        </span>
      </div>
    </Link>
  );
}

/**
 * Fetches all campaigns for the given creator address using the shared
 * `useInfiniteList` hook, applying infinite-scroll pagination.
 */
export function CampaignsSection({
  address,
  onCampaignsLoaded,
  pageSize = 8,
}: CampaignsSectionProps) {
  const { items, sentinelRef, isLoading, hasMore, error, retry } =
    useInfiniteList<CampaignData>({
      fetcher: async (page) => {
        const all = await fetchAllCampaigns();
        const creator = all.filter((c) => c.creator === address);
        const start = (page - 1) * pageSize;
        const slice = creator.slice(start, start + pageSize);
        return { items: slice, hasMore: start + pageSize < creator.length };
      },
    });

  // Notify parent once the first page resolves.
  useEffect(() => {
    if (items.length > 0) {
      onCampaignsLoaded?.(items);
    }
  }, [items, onCampaignsLoaded]);

  return (
    <section aria-labelledby="profile-campaigns-heading" className="space-y-3">
      <h2 id="profile-campaigns-heading" className="text-lg font-semibold">
        Campaigns Created
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
        <p className="text-sm text-gray-500">No campaigns created yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((c) => (
              <CampaignCardRow key={c.contractId} campaign={c} />
            ))}
          </div>

          {/* Inline error for subsequent pages */}
          {error && (
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
              All campaigns loaded.
            </p>
          )}
        </>
      )}
    </section>
  );
}
