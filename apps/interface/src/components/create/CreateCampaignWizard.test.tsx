/**
 * Covers the validation surface still re-exported from CreateCampaignWizard for
 * backwards compatibility after the per-step split. The exhaustive per-step
 * cases live in ./wizard/validators.test.ts.
 */

import {
  INITIAL,
  validateAllSteps,
  validateStep,
} from "./CreateCampaignWizard";

/** 30 days out — deadlines must be between 1 hour and 1 year in the future. */
const DEADLINE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0]!;

describe("CreateCampaignWizard validation", () => {
  it("requires a valid contract ID on the first step", () => {
    const data = { ...INITIAL, contractId: "", token: "G123" };
    expect(validateStep(0, data)).toBe("Contract ID is required.");
  });

  it("rejects an invalid contract ID format", () => {
    const data = {
      ...INITIAL,
      contractId: "C123",
      token: "G123",
      title: "Test",
      description: "Desc",
      goal: "100",
      deadline: DEADLINE,
      minContribution: "1",
    };
    expect(validateStep(0, data)).toBe("Contract ID is invalid.");
  });

  it("rejects an invalid video URL on the media step", () => {
    const data = { ...INITIAL, videoUrl: "ftp://example.com/video.mp4" };
    expect(validateStep(1, data)).toBe(
      "Enter a valid URL starting with https://",
    );
  });

  it("requires fee basis points when a fee address is provided", () => {
    const data = { ...INITIAL, feeAddress: "G123", feeBps: "" };
    expect(validateStep(3, data)).toBe(
      "Provide fee bps when a fee address is set.",
    );
  });

  it("passes validation for a complete campaign draft", () => {
    // Use a deadline 6 months from now (within the 1-year limit)
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    const deadline = sixMonthsFromNow.toISOString().split("T")[0];

    const data = {
      ...INITIAL,
      contractId: "C" + "A".repeat(55),
      token: "C" + "A".repeat(55),
      title: "Test Campaign",
      description: "A short description.",
      category: "health",
      goal: "100",
      deadline: DEADLINE,
      minContribution: "1",
      videoUrl: "https://example.com/video.mp4",
      feeAddress: "G123",
      feeBps: "250",
    };

    expect(validateAllSteps(data)).toBeNull();
  });
});
