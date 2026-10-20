"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { BarChart2, ArrowLeft, Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { WalletGuard } from "@/components/WalletGuard";
import { LazyAnalyticsDashboard } from "@/lib/lazy-components";
import { useWallet } from "@/hooks/useWallet";
import { fetchCampaignView } from "@/lib/graphql/client";
import { isValidContractId } from "@/lib/validation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type {
  CampaignData,
  CampaignInfo,
  CampaignStats,
} from "@fund-my-cause/types";

const REGISTRY_KEY = "fmc:campaigns";

function getContractIds(address: string): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const map: Record<string, string[]> = JSON.parse(raw);
    return map[address] ?? [];
  } catch {
    return [];
  }
}

type TimeRange = "7d" | "30d" | "90d" | "all";

export default function AnalyticsPage() {
  const { address } = useWallet();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [contractIds, setContractIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (!address) {
      setContractIds([]);
      return;
    }
    setContractIds(getContractIds(address));
  }, [address]);

  // Fetch all campaign data
  const campaignQueries = useQueries({
    queries: contractIds.map((contractId) => ({
      queryKey: QUERY_KEYS.campaign(contractId),
      queryFn: () => fetchCampaignView(contractId),
      enabled: isValidContractId(contractId),
      retry: false,
    })),
  });
  const campaignsData = campaignQueries.map((query) => ({
    info: query.data?.info ?? null,
    stats: query.data?.stats ?? null,
    loading: query.isLoading,
  }));

  const campaigns = useMemo(() => {
    return campaignsData
      .filter(
        (
          entry,
        ): entry is {
          info: CampaignInfo;
          stats: CampaignStats;
          loading: boolean;
        } => !!entry.info && !!entry.stats,
      )
      .map(
        ({ info, stats }) =>
          ({
            contractId: info.contractId,
            title: info.title,
            description: info.description,
            raised: Number(stats.totalRaised) / 10_000_000,
            goal: Number(stats.goal) / 10_000_000,
            deadline: new Date(Number(info.deadline) * 1000).toISOString(),
            creator: info.creator,
            socialLinks: info.socialLinks || [],
            contributorCount: stats.contributorCount,
            averageContribution: Number(stats.averageContribution) / 10_000_000,
            status: info.status,
          }) as CampaignData,
      );
  }, [campaignsData]);

  const loading = campaignsData.some(
    ({ loading }: { loading: boolean }) => loading,
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <WalletGuard message="Connect your wallet to view analytics.">
        <div className="mx-auto max-w-6xl px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <BarChart2 className="text-indigo-400" size={32} />
                  Campaign Analytics
                </h1>
                <p className="text-gray-400 mt-2">
                  Track performance metrics and insights for your campaigns
                </p>
              </div>

              {/* Time range selector */}
              <div className="flex items-center gap-2 bg-gray-900 rounded-xl p-1 border border-gray-800">
                {[
                  { value: "7d" as TimeRange, label: "7 Days" },
                  { value: "30d" as TimeRange, label: "30 Days" },
                  { value: "90d" as TimeRange, label: "90 Days" },
                  { value: "all" as TimeRange, label: "All Time" },
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setTimeRange(range.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      timeRange === range.value
                        ? "bg-indigo-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Analytics Dashboard */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
            </div>
          ) : contractIds.length === 0 ? (
            <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
              <BarChart2 size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">No Campaign Data</h3>
              <p className="text-gray-400 mb-6">
                Create your first campaign to start tracking analytics
              </p>
              <button
                onClick={() => router.push("/create")}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <LazyAnalyticsDashboard campaigns={campaigns} timeRange={timeRange} />
          )}
        </div>
      </WalletGuard>
    </main>
  );
}
