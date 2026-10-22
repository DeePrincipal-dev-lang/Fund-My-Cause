"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchContribution, fetchAllCampaigns } from "@/lib/graphql/client";

export interface ContributionEntry {
  contractId: string;
  campaignTitle: string;
  amount: number; // XLM
  date: number; // Unix ms timestamp (approximate — uses current time when not available)
}

interface UseContributionsResult {
  contributions: ContributionEntry[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Fetches all contributions made by the given address across all known campaigns.
 * Sorts results by date descending (most recent first).
 */
export function useContributions(address: string): UseContributionsResult {
  const [contributions, setContributions] = useState<ContributionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setContributions([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
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

        if (cancelled) return;

        const entries: ContributionEntry[] = [];
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.amount > 0) {
            const { campaign, amount } = result.value;
            entries.push({
              contractId: campaign.contractId,
              campaignTitle: campaign.title,
              amount,
              // Use campaign deadline as a proxy date when no tx timestamp available
              date: new Date(campaign.deadline).getTime(),
            });
          }
        }

        // Sort by date descending
        entries.sort((a, b) => b.date - a.date);
        setContributions(entries);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load contributions.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [address, nonce]);

  return { contributions, loading, error, retry };
}
