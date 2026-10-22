import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignCard } from "./CampaignCard";
import type { Campaign } from "@/types/campaign";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

jest.mock("@/context/ComparisonContext", () => ({
  useComparison: () => ({
    toggle: jest.fn(),
    isSelected: () => false,
    selected: [],
  }),
}));

jest.mock("@/context/BookmarkContext", () => ({
  useBookmarks: () => ({
    toggle: jest.fn(),
    isBookmarked: () => false,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockCampaign: Campaign = {
  id: "test-123",
  contractId: "CTEST123",
  title: "Save the Rainforest",
  description: "Help us protect endangered species",
  creator: "GCREATOR123",
  goal: 100,
  raised: 50,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CampaignCard", () => {
  it("renders campaign title", () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByText("Save the Rainforest")).toBeInTheDocument();
  });

  it("renders campaign description", () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(
      screen.getByText("Help us protect endangered species"),
    ).toBeInTheDocument();
  });

  it("displays progress percentage", () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders a pledge button", () => {
    render(<CampaignCard campaign={mockCampaign} />);
    const button = screen.getByRole("button", {
      name: /Pledge to Save the Rainforest/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("handles funded campaigns without crashing", () => {
    const fundedCampaign: Campaign = { ...mockCampaign, raised: 100 };
    render(<CampaignCard campaign={fundedCampaign} />);
    expect(screen.getByText("Save the Rainforest")).toBeInTheDocument();
  });

  it("shows category badge when category is set", () => {
    const catCampaign: Campaign = { ...mockCampaign, category: "technology" };
    render(<CampaignCard campaign={catCampaign} />);
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
  });
});
