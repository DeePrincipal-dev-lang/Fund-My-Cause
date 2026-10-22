import { useQuery } from "@tanstack/react-query";
import {
  getCampaignDetailData,
  type CampaignDetailViewData,
} from "@/lib/campaignDetail";

export interface UseCampaignDetailOptions {
  initialData?: CampaignDetailViewData;
  enabled?: boolean;
}

export function useCampaignDetail(
  campaignId: string,
  options?: UseCampaignDetailOptions,
) {
  return useQuery<CampaignDetailViewData, Error>({
    queryKey: ["campaign-detail", campaignId],
    queryFn: () => getCampaignDetailData(campaignId),
    enabled: options?.enabled ?? Boolean(campaignId),
    initialData: options?.initialData,
  });
}
