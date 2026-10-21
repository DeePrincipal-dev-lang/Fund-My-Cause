"use client";

import React, { useState } from "react";
import type { Campaign } from "@/types/campaign";
import { cn } from "@/lib/utils";
import { getComparisonValue, type ComparisonMetric } from "@/lib/comparison";

type ChartMetric = ComparisonMetric;

const CHART_METRICS: { label: string; value: ChartMetric }[] = [
  { label: "Amount Raised", value: "raised" },
  { label: "Goal", value: "goal" },
  { label: "Progress %", value: "progress" },
  { label: "Contributors", value: "contributors" },
];

const BAR_COLORS = [
  "hsl(245, 80%, 65%)",
  "hsl(160, 70%, 50%)",
  "hsl(30, 90%, 60%)",
  "hsl(340, 75%, 60%)",
];

function formatValue(value: number, metric: ChartMetric): string {
  switch (metric) {
    case "raised":
    case "goal":
      return value.toLocaleString() + " XLM";
    case "progress":
      return value + "%";
    case "contributors":
      return value.toLocaleString();
    default:
      return String(value);
  }
}

interface ComparisonChartProps {
  campaigns: Campaign[];
}

export function ComparisonChart({ campaigns }: ComparisonChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("raised");

  if (campaigns.length === 0) return null;

  const values = campaigns.map((c) => getComparisonValue(c, metric));
  const maxValue = Math.max(...values, 1);

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      data-testid="comparison-chart"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Visual Comparison
        </h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chart metric">
          {CHART_METRICS.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={metric === m.value}
              onClick={() => setMetric(m.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition",
                metric === m.value
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="space-y-4" role="img" aria-label={`Bar chart comparing ${metric}`}>
        {campaigns.map((campaign, i) => {
          const value = values[i];
          const widthPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];

          return (
            <div key={campaign.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[60%]">
                  {campaign.title}
                </span>
                <span
                  className="text-[var(--color-text-secondary)] font-mono text-xs"
                  data-testid={`chart-value-${campaign.id}`}
                >
                  {formatValue(value, metric)}
                </span>
              </div>
              <div className="w-full h-8 bg-[var(--color-surface-elevated)] rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(widthPct, 1)}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                  }}
                  role="meter"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={maxValue}
                  aria-label={`${campaign.title}: ${formatValue(value, metric)}`}
                />
                {/* Glow effect */}
                <div
                  className="absolute top-0 left-0 h-full rounded-lg opacity-30 blur-sm"
                  style={{
                    width: `${Math.max(widthPct, 1)}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4" aria-label="Chart legend">
        {campaigns.map((campaign, i) => (
          <div key={campaign.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
            />
            <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">
              {campaign.title}
            </span>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {campaigns.map((campaign, i) => {
          const progress =
            campaign.goal > 0
              ? Math.round((campaign.raised / campaign.goal) * 100)
              : 0;
          return (
            <div
              key={campaign.id}
              className="rounded-xl p-3 border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]"
            >
              <div
                className="w-2 h-2 rounded-full mb-2"
                style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
              <p className="text-xs text-[var(--color-text-muted)] truncate mb-1">
                {campaign.title}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {progress}%
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">funded</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
