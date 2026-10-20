import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampaignCardMedia } from "./CampaignCardMedia";
import type { Campaign } from "@/types/campaign";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@fund-my-cause/components", () => ({
  CampaignHeaderActions: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div>{children}</div>,
}));

const mockCampaign: Campaign = {
  id: "test-1",
  contractId: "CTEST1",
  title: "Ocean Cleanup",
  description: "Remove plastic from oceans",
  creator: "GCREATOR1",
  raised: 50,
  goal: 100,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

describe("CampaignCardMedia", () => {
  it("renders funded badge when isFunded is true", () => {
    render(
      <CampaignCardMedia
        campaign={mockCampaign}
        isFunded={true}
        isEnded={false}
        bookmarked={false}
        onToggleBookmark={jest.fn()}
      />,
    );
    expect(screen.getByText("funded")).toBeInTheDocument();
  });

  it("does not render funded badge when isFunded is false", () => {
    render(
      <CampaignCardMedia
        campaign={mockCampaign}
        isFunded={false}
        isEnded={false}
        bookmarked={false}
        onToggleBookmark={jest.fn()}
      />,
    );
    expect(screen.queryByText("funded")).not.toBeInTheDocument();
  });

  it("renders ended badge when isEnded is true", () => {
    render(
      <CampaignCardMedia
        campaign={mockCampaign}
        isFunded={false}
        isEnded={true}
        bookmarked={false}
        onToggleBookmark={jest.fn()}
      />,
    );
    expect(screen.getByText("ended")).toBeInTheDocument();
  });

  it("renders video indicator when campaign has videoUrl", () => {
    const campaignWithVideo: Campaign = {
      ...mockCampaign,
      videoUrl: "https://example.com/video.mp4",
    };
    render(
      <CampaignCardMedia
        campaign={campaignWithVideo}
        isFunded={false}
        isEnded={false}
        bookmarked={false}
        onToggleBookmark={jest.fn()}
      />,
    );
    expect(screen.getByText(/video/i)).toBeInTheDocument();
  });

  it("calls onToggleBookmark when bookmark button is clicked", () => {
    const onToggleBookmark = jest.fn();
    render(
      <CampaignCardMedia
        campaign={mockCampaign}
        isFunded={false}
        isEnded={false}
        bookmarked={false}
        onToggleBookmark={onToggleBookmark}
      />,
    );
    const bookmarkButton = screen.getByRole("button", {
      name: /bookmarkCampaign/i,
    });
    fireEvent.click(bookmarkButton);
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);
  });

  it("calls onShare when share button is clicked", () => {
    const onShare = jest.fn();
    render(
      <CampaignCardMedia
        campaign={mockCampaign}
        isFunded={false}
        isEnded={false}
        bookmarked={false}
        onToggleBookmark={jest.fn()}
        onShare={onShare}
      />,
    );
    const shareButton = screen.getByRole("button", {
      name: /shareCampaign/i,
    });
    fireEvent.click(shareButton);
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
