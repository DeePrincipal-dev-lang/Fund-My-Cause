"use client";

import React from "react";
import type { Campaign } from "@/types/campaign";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatXlm } from "@/lib/price";
import { formatCampaignDateShort } from "@/lib/campaignDateFormatting";
import { TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getComparisonValue } from "@/lib/comparison";

interface ComparisonTableProps {
  campaigns: Campaign[];
  onRemove: (id: string) => void;
}

function TrendIndicator({ value, best }: { value: number; best: number }) {
  if (value === best) {
    return (
      <TrendingUp
        size={14}
        className="text-[var(--color-success)] inline ml-1"
        aria-label="Best"
      />
    );
  }
  return null;
}

export function ComparisonTable({ campaigns, onRemove }: ComparisonTableProps) {
  if (campaigns.length === 0) return null;

  const maxRaised = Math.max(...campaigns.map((c) => getComparisonValue(c, "raised")));
  const maxContributors = Math.max(
    ...campaigns.map((c) => getComparisonValue(c, "contributors")),
  );
  const maxProgress = Math.max(
    ...campaigns.map((c) => (c.goal > 0 ? c.raised / c.goal : 0)),
  );

  const rows: {
    label: string;
    key: string;
    render: (c: Campaign) => React.ReactNode;
  }[] = [
    {
      label: "Status",
      key: "status",
      render: (c) => {
        const statusColors: Record<string, string> = {
          Active: "bg-[var(--color-success)]/20 text-[var(--color-success)]",
          Successful: "bg-[var(--color-brand)]/20 text-[var(--color-brand)]",
          Refunded: "bg-[var(--color-warning)]/20 text-[var(--color-warning)]",
          Cancelled: "bg-[var(--color-danger)]/20 text-[var(--color-danger)]",
          Paused:
            "bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]",
        };
        return (
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
              statusColors[c.status] ?? "",
            )}
          >
            {c.status}
          </span>
        );
      },
    },
    {
      label: "Amount Raised",
      key: "raised",
      render: (c) => (
        <span className="font-mono text-sm">
          {formatXlm(c.raised, null)}
          <TrendIndicator value={c.raised} best={maxRaised} />
        </span>
      ),
    },
    {
      label: "Goal",
      key: "goal",
      render: (c) => (
        <span className="font-mono text-sm">{formatXlm(c.goal, null)}</span>
      ),
    },
    {
      label: "Progress",
      key: "progress",
      render: (c) => {
        const pct = c.goal > 0 ? (c.raised / c.goal) * 100 : 0;
        const ratio = c.goal > 0 ? c.raised / c.goal : 0;
        return (
          <div className="space-y-1 min-w-[120px]">
            <ProgressBar progress={pct} />
            {ratio === maxProgress && campaigns.length > 1 && (
              <span className="text-[10px] text-[var(--color-success)] font-medium">
                ★ Highest
              </span>
            )}
          </div>
        );
      },
    },
    {
      label: "Deadline",
      key: "deadline",
      render: (c) => {
        const d = new Date(c.deadline);
        const now = new Date();
        const daysLeft = Math.ceil(
          (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          <div>
            <span className="text-sm">
              {formatCampaignDateShort(c.deadline)}
            </span>
            <br />
            <span
              className={cn(
                "text-xs",
                daysLeft > 0
                  ? "text-[var(--color-text-muted)]"
                  : "text-[var(--color-danger)]",
              )}
            >
              {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
            </span>
          </div>
        );
      },
    },
    {
      label: "Contributors",
      key: "contributors",
      render: (c) => (
        <span className="font-mono text-sm">
          {c.contributorCount?.toLocaleString() ?? "—"}
          <TrendIndicator
            value={c.contributorCount ?? 0}
            best={maxContributors}
          />
        </span>
      ),
    },
    {
      label: "Token",
      key: "token",
      render: (c) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]">
          {c.token}
        </span>
      ),
    },
    {
      label: "Category",
      key: "category",
      render: (c) => (
        <span className="text-sm capitalize text-[var(--color-text-secondary)]">
          {c.category ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      data-testid="comparison-table"
    >
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left px-5 py-4 text-[var(--color-text-muted)] font-medium w-36 sticky left-0 bg-[var(--color-surface)] z-10">
              Metric
            </th>
            {campaigns.map((c) => (
              <th key={c.id} className="px-5 py-4 text-left min-w-[180px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)] text-base">
                      {c.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] font-normal mt-0.5">
                      by {c.creator.substring(0, 8)}...
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(c.id)}
                    aria-label={`Remove ${c.title} from comparison`}
                    className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-elevated)] transition flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.key}
              className={cn(
                "transition",
                i % 2 === 0
                  ? "bg-[var(--color-background)]"
                  : "bg-[var(--color-surface)]",
                "hover:bg-[var(--color-surface-elevated)]",
              )}
            >
              <td className="px-5 py-4 text-[var(--color-text-muted)] font-medium sticky left-0 z-10 bg-inherit">
                {row.label}
              </td>
              {campaigns.map((c) => (
                <td
                  key={c.id}
                  className="px-5 py-4 text-[var(--color-text-primary)]"
                >
                  {row.render(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
