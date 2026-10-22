import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignDetailHeader } from "./CampaignDetailHeader";

jest.mock("@/lib/campaignDetailFormat", () => ({
  truncateAddress: (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`,
}));

describe("CampaignDetailHeader", () => {
  it("renders campaign title", () => {
    render(
      <CampaignDetailHeader
        title="Save the Whales"
        creator="GBRPYHIL2CI3WHQTQONCOQAHLRNNQFU5EXNXTY3P"
      />,
    );
    expect(screen.getByText("Save the Whales")).toBeInTheDocument();
  });

  it("renders creator address with truncation", () => {
    const creator = "GBRPYHIL2CI3WHQTQONCOQAHLRNNQFU5EXNXTY3P";
    render(<CampaignDetailHeader title="Campaign Title" creator={creator} />);
    const creatorElement = screen.getByTitle(creator);
    expect(creatorElement).toHaveTextContent("GBRPY...3P");
  });

  it("renders 'by' text before creator", () => {
    render(
      <CampaignDetailHeader
        title="Campaign Title"
        creator="GBRPYHIL2CI3WHQTQONCOQAHLRNNQFU5EXNXTY3P"
      />,
    );
    expect(screen.getByText(/by/)).toBeInTheDocument();
  });

  it("has proper heading hierarchy with h1", () => {
    render(
      <CampaignDetailHeader
        title="Test Campaign"
        creator="GBRPYHIL2CI3WHQTQONCOQAHLRNNQFU5EXNXTY3P"
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Test Campaign");
  });

  it("displays creator address in title attribute for accessibility", () => {
    const creator = "GBRPYHIL2CI3WHQTQONCOQAHLRNNQFU5EXNXTY3P";
    render(<CampaignDetailHeader title="Campaign" creator={creator} />);
    const creatorSpan = screen.getByTitle(creator);
    expect(creatorSpan).toBeInTheDocument();
  });
});
