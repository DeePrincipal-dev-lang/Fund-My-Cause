import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCampaignDetail } from "./useCampaignDetail";
import type { Campaign } from "@/types/campaign";

jest.mock("@/lib/graphql/client");
jest.mock("@/lib/price");

const { fetchCampaign } = jest.requireMock("@/lib/graphql/client") as {
  fetchCampaign: jest.Mock;
};
const { fetchXlmPrice } = jest.requireMock("@/lib/price") as {
  fetchXlmPrice: jest.Mock;
};

const mockCampaign: Campaign = {
  id: "test-campaign-id",
  title: "Save the Forest",
  description: "Planting 10,000 trees",
  raised: 5000,
  goal: 10000,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  category: "environment",
  creator: "GBABC12345678901234567890",
  image: "https://example.com/image.jpg",
  contributorCount: 25,
  averageContribution: 200,
  socialLinks: ["https://twitter.com/savetheforest"],
  status: "Active",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useCampaignDetail", () => {
  it("fetches campaign and price data successfully", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    fetchXlmPrice.mockResolvedValue(0.15);

    const { result } = renderHook(() => useCampaignDetail("test-campaign-id"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.campaign).toEqual(mockCampaign);
    expect(result.current.data?.xlmPrice).toBe(0.15);
    expect(result.current.data?.progress).toBe(50);
    expect(result.current.data?.deadlinePassed).toBe(false);
    expect(result.current.data?.goalMet).toBe(false);
  });

  it("handles price fetch failure gracefully", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    fetchXlmPrice.mockRejectedValue(new Error("CoinGecko rate limit"));

    const { result } = renderHook(() => useCampaignDetail("test-campaign-id"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.campaign).toEqual(mockCampaign);
    expect(result.current.data?.xlmPrice).toBeNull();
  });

  it("calculates goalMet and deadlinePassed correctly", async () => {
    const fundedCampaign: Campaign = {
      ...mockCampaign,
      raised: 12000,
      goal: 10000,
      deadline: new Date(Date.now() - 86400000).toISOString(),
    };

    fetchCampaign.mockResolvedValue(fundedCampaign);
    fetchXlmPrice.mockResolvedValue(0.2);

    const { result } = renderHook(() => useCampaignDetail("test-campaign-id"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.progress).toBe(120);
    expect(result.current.data?.goalMet).toBe(true);
    expect(result.current.data?.deadlinePassed).toBe(true);
  });
});
