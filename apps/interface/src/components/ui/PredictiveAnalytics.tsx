"use client";

import { CampaignData } from "@/types/soroban";
import { buildTrendForecast, compareCampaigns } from "@/lib/predictiveModeling";

interface Props {
  campaigns: CampaignData[];
  connected: boolean;
  lastUpdated: number;
  error?: string | null;
}

export function PredictiveAnalytics({ campaigns, connected, lastUpdated, error }: Props) {
  if (campaigns.length === 0) {
    return null;
  }

  const benchmarks = compareCampaigns(campaigns);
  const leadCampaign = benchmarks[0];
  const averageProbability = Math.round(
    benchmarks.reduce((sum, item) => sum + item.successProbability, 0) / Math.max(benchmarks.length, 1)
  );
  const forecast = buildTrendForecast(campaigns);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-300">Predictive Analytics</p>
          <p className="text-xs text-gray-500">Real-time campaign forecasting and benchmarking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className={`px-2 py-1 rounded-full ${connected ? "bg-emerald-900 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
            {connected ? "Real-time connected" : "Live snapshot"}
          </span>
          <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-950 border border-red-900 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-gray-950/60 border border-gray-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">Average success</p>
          <p className="text-3xl font-semibold text-white mt-3">{averageProbability}%</p>
        </div>
        <div className="bg-gray-950/60 border border-gray-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">Top campaign</p>
          <p className="text-lg font-semibold text-white mt-3 truncate">{leadCampaign?.title || "—"}</p>
          <p className="text-sm text-gray-400 mt-1">{leadCampaign?.successProbability}% probability</p>
        </div>
        <div className="bg-gray-950/60 border border-gray-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">Campaigns benchmarked</p>
          <p className="text-3xl font-semibold text-white mt-3">{benchmarks.length}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-gray-950/60 border border-gray-800 p-4 rounded-2xl">
          <p className="text-sm font-semibold text-gray-300 mb-3">Success probability ranking</p>
          <div className="space-y-3">
            {benchmarks.slice(0, 3).map((campaign) => (
              <div key={campaign.contractId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{campaign.title}</p>
                  <p className="text-xs text-gray-500">{campaign.status} campaign</p>
                </div>
                <span className="text-sm font-semibold text-indigo-300">{campaign.successProbability}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-950/60 border border-gray-800 p-4 rounded-2xl">
          <p className="text-sm font-semibold text-gray-300 mb-3">Forecast scorecard</p>
          <div className="space-y-3">
            {forecast.map((point) => (
              <div key={point.label}>
                <div className="flex justify-between text-sm text-gray-400">
                  <span className="truncate">{point.label}</span>
                  <span>{point.value}%</span>
                </div>
                <div className="h-2 mt-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${point.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
