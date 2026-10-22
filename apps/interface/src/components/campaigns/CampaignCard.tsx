"use client";

import React from "react";
import { Campaign } from "@/types/campaign";

export interface CampaignCardProps {
  campaign: Campaign;
  onPledge: (campaignId: string) => void;
  index?: number;
}

export function CampaignCard({ campaign, onPledge, index = 0 }: CampaignCardProps) {
  const progress = Math.min(100, (campaign.raised / campaign.goal) * 100);
  const daysLeft = campaign.deadline
    ? Math.ceil(
        (new Date(campaign.deadline).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const status = campaign.raised >= campaign.goal ? "funded" : "active";

  return (
    <div data-testid={`campaign-card-${index}`} className="campaign-card">
      <div className="campaign-header">
        <h3 data-testid="campaign-title">{campaign.title}</h3>
        <span data-testid="campaign-status" className={`status-${status}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <p data-testid="campaign-description">{campaign.description}</p>

      <div className="campaign-info">
        <span data-testid="campaign-creator">By {campaign.creator}</span>
        {daysLeft > 0 && (
          <span data-testid="days-left">{daysLeft} days left</span>
        )}
      </div>

      <div className="progress-section">
        <div data-testid="progress-bar" className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
            data-testid="progress-fill"
          />
        </div>

        <div className="progress-info">
          <span data-testid="raised-amount">
            ${campaign.raised.toLocaleString()}
          </span>
          <span data-testid="goal-amount">
            {" "}
            of ${campaign.goal.toLocaleString()}
          </span>
        </div>

        <div className="progress-percentage">
          <span data-testid="progress-percentage">{Math.round(progress)}%</span>
        </div>
      </div>

      <button
        onClick={() => onPledge(campaign.id)}
        data-testid="pledge-button"
        disabled={status === "funded"}
      >
        {status === "funded" ? "Funded" : "Pledge Now"}
      </button>
    </div>
  );
}
