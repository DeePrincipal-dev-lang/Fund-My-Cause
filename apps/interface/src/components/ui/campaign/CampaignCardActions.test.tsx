import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampaignCardActions } from "./CampaignCardActions";
import type { Campaign } from "@/types/campaign";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) =>
    params ? `${key}:${params.title ?? ""}` : key,
}));

const mockCampaign: Campaign = {
  id: "test-1",
  contractId: "CTEST1",
  title: "Save the Rainforest",
  description: "Protect endangered species",
  creator: "GCREATOR1",
  raised: 50,
  goal: 100,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

describe("CampaignCardActions", () => {
  it("renders pledge button", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onPledge when pledge button is clicked", () => {
    const onPledge = jest.fn();
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={onPledge}
        isFunded={false}
        isEnded={false}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onPledge).toHaveBeenCalledTimes(1);
  });

  it("disables pledge button when isFunded", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={true}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables pledge button when isEnded", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={true}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders compare checkbox", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("calls onToggleCompare when checkbox changes", () => {
    const onToggleCompare = jest.fn();
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={onToggleCompare}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleCompare).toHaveBeenCalledTimes(1);
  });

  it("disables compare checkbox when compareDisabled is true", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={true}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("shows compared state in checkbox", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={true}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows successfullyFunded text when isFunded", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={true}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("successfullyFunded");
  });

  it("shows campaignEnded text when isEnded", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={true}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("campaignEnded");
  });

  it("shows pledgeNow text for active campaign", () => {
    render(
      <CampaignCardActions
        campaign={mockCampaign}
        compared={false}
        compareDisabled={false}
        onToggleCompare={jest.fn()}
        onPledge={jest.fn()}
        isFunded={false}
        isEnded={false}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("pledgeNow");
  });
});
