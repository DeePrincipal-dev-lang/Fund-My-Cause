/**
 * Tests for dark-mode-aware chart palette selection (#659).
 *
 * useTheme is mocked globally (via jest.config.ts moduleNameMapper) to return
 * dark theme by default. We test the palette helper functions directly
 * (no ThemeProvider needed) and then integration-render both charts.
 */
import { render, screen } from "@testing-library/react";
import { getLineChartPalette, LineChart } from "../LineChart";
import { getPieChartPalette, PieChart } from "../PieChart";
import { CampaignData } from "@/types/soroban";

const mockCampaigns: CampaignData[] = [
  {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    title: "Campaign A",
    description: "desc",
    raised: 500,
    goal: 1000,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    creator: "GABCDE",
    socialLinks: [],
    contributorCount: 5,
    averageContribution: 100,
    status: "Active",
  },
];

// ── Palette unit tests ──────────────────────────────────────────────────────

describe("getLineChartPalette", () => {
  it("returns dark palette for dark theme", () => {
    const p = getLineChartPalette("dark");
    expect(p.background).toContain("gray-900");
    expect(p.gridStroke).toBe("#374151");
    expect(p.lineStart).toBe("#6366f1");
  });

  it("returns light palette for light theme", () => {
    const p = getLineChartPalette("light");
    expect(p.background).toContain("white");
    expect(p.gridStroke).toBe("#e5e7eb");
    expect(p.lineStart).toBe("#4f46e5");
  });

  it("dark and light palettes have different backgrounds", () => {
    expect(getLineChartPalette("dark").background).not.toBe(
      getLineChartPalette("light").background,
    );
  });

  it("dark and light palettes have different grid colours", () => {
    expect(getLineChartPalette("dark").gridStroke).not.toBe(
      getLineChartPalette("light").gridStroke,
    );
  });
});

describe("getPieChartPalette", () => {
  it("returns dark palette for dark theme", () => {
    const p = getPieChartPalette("dark");
    expect(p.background).toContain("gray-900");
    expect(p.centerTotal).toBe("text-white");
  });

  it("returns light palette for light theme", () => {
    const p = getPieChartPalette("light");
    expect(p.background).toContain("white");
    expect(p.centerTotal).toBe("text-gray-900");
  });

  it("dark and light palettes differ on label colour", () => {
    expect(getPieChartPalette("dark").label).not.toBe(
      getPieChartPalette("light").label,
    );
  });
});

// ── Integration: charts render using the mocked (dark) theme ─────────────────

describe("LineChart theme integration", () => {
  it("renders chart title and SVG", () => {
    render(<LineChart campaigns={mockCampaigns} />);
    expect(screen.getByText(/Funding Progress Over Time/)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders legend items", () => {
    render(<LineChart campaigns={mockCampaigns} />);
    expect(screen.getByText(/Campaign A/)).toBeInTheDocument();
  });
});

describe("PieChart theme integration", () => {
  it("renders chart title and SVG", () => {
    render(<PieChart campaigns={mockCampaigns} />);
    expect(screen.getByText(/Campaign Status Distribution/)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders status in legend", () => {
    render(<PieChart campaigns={mockCampaigns} />);
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });
});
