"use client";

import React from "react";
import { CheckCircle, AlertCircle, Clock, TrendingUp, Users } from "lucide-react";
import type { Campaign } from "@/types/campaign";

interface NextAction {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Compute actionable items based on campaign state
 */
function computeNextActions(campaigns: Campaign[]): NextAction[] {
  const actions: NextAction[] = [];

  campaigns.forEach((campaign) => {
    const now = Date.now() / 1000;
    const deadline = new Date(campaign.deadline).getTime() / 1000;
    const progress = campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
    const timeLeft = Math.max(0, deadline - now);

    // High priority: Goal met, ready to withdraw
    if (campaign.status === "Active" && progress >= 100) {
      actions.push({
        id: `${campaign.id}-withdraw`,
        priority: "high",
        title: "Withdraw Funds Available",
        description: `Your campaign "${campaign.title}" has met its goal. Withdraw ${(campaign.raised).toFixed(2)} XLM now.`,
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        action: {
          label: "Withdraw Now",
          onClick: () => {
            // Navigate to withdrawal flow
            window.location.href = `/campaigns/${campaign.id}?action=withdraw`;
          },
        },
      });
    }

    // High priority: Deadline approaching
    if (campaign.status === "Active" && timeLeft > 0 && timeLeft < 86400) {
      actions.push({
        id: `${campaign.id}-deadline`,
        priority: "high",
        title: "Deadline Approaching",
        description: `Your campaign "${campaign.title}" ends in less than 24 hours. Share to boost contributions!`,
        icon: <Clock className="w-5 h-5 text-orange-500" />,
        action: {
          label: "Share Campaign",
          onClick: () => {
            window.location.href = `/campaigns/${campaign.id}?action=share`;
          },
        },
      });
    }

    // Medium priority: Goal not met, campaign ending soon
    if (campaign.status === "Active" && progress < 100 && timeLeft > 0 && timeLeft < 259200) {
      actions.push({
        id: `${campaign.id}-boost`,
        priority: "medium",
        title: "Boost Fundraising Effort",
        description: `Campaign "${campaign.title}" is at ${progress.toFixed(1)}% of goal. Extend deadline or share to increase momentum.`,
        icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
        action: {
          label: "Extend Deadline",
          onClick: () => {
            window.location.href = `/campaigns/${campaign.id}?action=extend`;
          },
        },
      });
    }

    // Medium priority: Contributor engagement
    if (campaign.status === "Active" && campaign.contributorCount && campaign.contributorCount > 0) {
      const engagement = campaign.contributorCount > 10 ? "high" : "moderate";
      if (engagement === "moderate") {
        actions.push({
          id: `${campaign.id}-engagement`,
          priority: "medium",
          title: "Engage Contributors",
          description: `You have ${campaign.contributorCount} contributors. Post an update to maintain momentum.`,
          icon: <Users className="w-5 h-5 text-purple-500" />,
          action: {
            label: "Post Update",
            onClick: () => {
              window.location.href = `/campaigns/${campaign.id}?action=update`;
            },
          },
        });
      }
    }

    // Low priority: Refunds pending (for failed campaigns)
    if (campaign.status === "Refunded") {
      actions.push({
        id: `${campaign.id}-refunded`,
        priority: "low",
        title: "Campaign Refunded",
        description: `Campaign "${campaign.title}" did not meet its goal and has been refunded.`,
        icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
      });
    }
  });

  // Sort by priority (high > medium > low) then by ID
  return actions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

interface NextActionsPanelProps {
  campaigns: Campaign[];
  onActionClick?: (actionId: string) => void;
}

export function NextActionsPanel({ campaigns, onActionClick }: NextActionsPanelProps) {
  const actions = computeNextActions(campaigns);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
      <h3 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">
        Next Actions
      </h3>
      <div className="space-y-3">
        {actions.slice(0, 5).map((action) => (
          <div
            key={action.id}
            className={`flex items-start gap-3 rounded-md border p-3 ${
              action.priority === "high"
                ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                : action.priority === "medium"
                  ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                  : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
            }`}
          >
            <div className="flex-shrink-0">{action.icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm">{action.title}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {action.description}
              </p>
            </div>
            {action.action && (
              <button
                onClick={() => {
                  onActionClick?.(action.id);
                  action.action?.onClick();
                }}
                className="flex-shrink-0 ml-2 px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 whitespace-nowrap"
              >
                {action.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { computeNextActions };
