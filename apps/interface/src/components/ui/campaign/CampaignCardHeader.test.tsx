import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignCardHeader } from "./CampaignCardHeader";
import type { Campaign } from "@/types/campaign";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

jest.mock("@fund-my-cause/components", () => ({
  CampaignHeader: ({
    title,
    description,
    overlay,
    children,
  }: {
    title: React.ReactNode;
    description: React.ReactNode;
    overlay?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="header-title">{title}</div>
      <div data-testid="header-description">{description}</div>
      {overlay && <div data-testid="header-overlay">{overlay}</div>}
      {children}
    </div>
  ),
}));

const mockCampaign: Campaign = {
  id: "test-1",
  contractId: "CTEST1",
  title: "Clean Energy Future",
  description: "Building solar panels for communities",
  creator: "GCREATOR1",
  raised: 40,
  goal: 100,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

describe("CampaignCardHeader", () => {
  it("renders campaign title", () => {
    render(
      <CampaignCardHeader
        campaign={mockCampaign}
        resolvedImageUrl="https://example.com/img.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        overlay={null}
        onImageError={jest.fn()}
      >
        <div />
      </CampaignCardHeader>,
    );
    expect(screen.getByTestId("header-title")).toHaveTextContent(
      "Clean Energy Future",
    );
  });

  it("renders campaign description", () => {
    render(
      <CampaignCardHeader
        campaign={mockCampaign}
        resolvedImageUrl="https://example.com/img.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        overlay={null}
        onImageError={jest.fn()}
      >
        <div />
      </CampaignCardHeader>,
    );
    expect(screen.getByTestId("header-description")).toHaveTextContent(
      "Building solar panels for communities",
    );
  });

  it("renders overlay content", () => {
    render(
      <CampaignCardHeader
        campaign={mockCampaign}
        resolvedImageUrl="https://example.com/img.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        overlay={<span>badge</span>}
        onImageError={jest.fn()}
      >
        <div />
      </CampaignCardHeader>,
    );
    expect(screen.getByTestId("header-overlay")).toBeInTheDocument();
    expect(screen.getByText("badge")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <CampaignCardHeader
        campaign={mockCampaign}
        resolvedImageUrl="https://example.com/img.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        overlay={null}
        onImageError={jest.fn()}
      >
        <div data-testid="child-content">progress</div>
      </CampaignCardHeader>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("highlights query text in title", () => {
    render(
      <CampaignCardHeader
        campaign={mockCampaign}
        query="Energy"
        resolvedImageUrl="https://example.com/img.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        overlay={null}
        onImageError={jest.fn()}
      >
        <div />
      </CampaignCardHeader>,
    );
    expect(screen.getByRole("mark")).toHaveTextContent("Energy");
  });
});
