"use client";

import { ReviewRow } from "../Fields";
import type { CampaignFormData } from "../types";

export interface ReviewStepProps {
  data: CampaignFormData;
}

/**
 * Wizard step 5 — a read-only summary of everything entered so far, shown
 * immediately before the full-draft validation that gates deployment.
 */
export function ReviewStep({ data }: ReviewStepProps) {
  const deadlineTs = data.deadline
    ? new Date(data.deadline).toLocaleDateString()
    : "—";

  return (
    <div className="space-y-1">
      <ReviewRow label="Contract ID" value={data.contractId} />
      <ReviewRow label="Token" value={data.token} />
      <ReviewRow label="Title" value={data.title} />
      <ReviewRow label="Description" value={data.description} />
      <ReviewRow label="Category" value={data.category} />
      <ReviewRow label="Goal" value={data.goal ? `${data.goal} XLM` : ""} />
      <ReviewRow
        label="Min Contribution"
        value={data.minContribution ? `${data.minContribution} XLM` : ""}
      />
      <ReviewRow label="Deadline" value={deadlineTs} />
      <ReviewRow label="Image" value={data.imageUrl} />
      <ReviewRow
        label="FAQs"
        value={data.faqs.length ? `${data.faqs.length} added` : "—"}
      />
      <ReviewRow
        label="Team Members"
        value={
          data.teamMembers.length ? `${data.teamMembers.length} added` : "—"
        }
      />
      <ReviewRow label="Fee Address" value={data.feeAddress} />
      <ReviewRow label="Fee (bps)" value={data.feeBps} />
    </div>
  );
}
