import { fetchCampaign } from "@/lib/graphql/client";
import { fetchXlmPrice } from "@/lib/price";
import type { Campaign } from "@/types/campaign";

export interface CampaignDetailViewData {
  campaign: Campaign;
  xlmPrice: number | null;
  progress: number;
  deadlinePassed: boolean;
  goalMet: boolean;
}

export async function getCampaignDetailData(
  id: string,
): Promise<CampaignDetailViewData> {
  const campaign = await fetchCampaign(id);
  const xlmPrice = await fetchXlmPrice().catch(() => null);

  const progress =
    campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
  const deadlinePassed = new Date(campaign.deadline) < new Date();
  const goalMet = campaign.raised >= campaign.goal;

  return {
    campaign,
    xlmPrice,
    progress,
    deadlinePassed,
    goalMet,
  };
}
