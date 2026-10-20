import { describe, it, expect } from "vitest";
import { formatCampaignCard } from "../utils/formatCampaignCard";
import {
  activeCampaign,
  fundedCampaign,
  refundingCampaign,
  draftCampaign,
} from "../../../../fixtures/campaign";

// The formatCampaignCard utility operates on plain numbers; the fixtures store
// BigInt values as decimal strings.  Convert once at the top level.
const activeRaised = Number(activeCampaign.raised); // 4_500_000_000
const activeGoal = Number(activeCampaign.goal); // 10_000_000_000
const activeDeadline = new Date(activeCampaign.deadline).getTime();

const fundedRaised = Number(fundedCampaign.raised); // 5_250_000_000
const fundedGoal = Number(fundedCampaign.goal); // 5_000_000_000
const fundedDeadline = new Date(fundedCampaign.deadline).getTime();

const refundRaised = Number(refundingCampaign.raised); // 2_100_000_000
const refundGoal = Number(refundingCampaign.goal); // 8_000_000_000
const refundDeadline = new Date(refundingCampaign.deadline).getTime(); // past

const zeroRaised = Number(draftCampaign.raised); // 0
const zeroGoal = Number(draftCampaign.goal); // 2_000_000_000

describe("formatCampaignCard", () => {
  describe("progress and funded state", () => {
    it("computes percent and displayPercent for the active campaign fixture (partially funded)", () => {
      const result = formatCampaignCard({ raised: activeRaised, goal: activeGoal });
      expect(result.percent).toBe(45);
      expect(result.displayPercent).toBe(45);
      expect(result.isFunded).toBe(false);
    });

    it("reports isFunded once the goal is reached (funded campaign fixture)", () => {
      const result = formatCampaignCard({
        raised: fundedRaised,
        goal: fundedGoal,
      });
      expect(result.isFunded).toBe(true);
    });

    it("does not clamp percent for an over-funded campaign, but clamps displayPercent", () => {
      // fundedCampaign: raised 5_250_000_000 vs goal 5_000_000_000 → 105%
      const result = formatCampaignCard({
        raised: fundedRaised,
        goal: fundedGoal,
      });
      expect(result.percent).toBe(105);
      expect(result.displayPercent).toBe(100);
      expect(result.isFunded).toBe(true);
    });

    it("returns 0% for the draft campaign fixture which has zero raised and goal > 0", () => {
      expect(
        formatCampaignCard({ raised: zeroRaised, goal: zeroGoal }).percent,
      ).toBe(0);
    });

    it("returns 0% for a zero goal (defensive — fixtures always have positive goals)", () => {
      expect(formatCampaignCard({ raised: 10, goal: 0 }).percent).toBe(0);
      expect(formatCampaignCard({ raised: 10, goal: -5 }).percent).toBe(0);
    });
  });

  describe("ended state", () => {
    const now = Date.now();

    it("is not ended when the deadline is in the future (active campaign fixture)", () => {
      const result = formatCampaignCard(
        { raised: activeRaised, goal: activeGoal, deadline: activeDeadline },
        { now },
      );
      expect(result.isEnded).toBe(false);
    });

    it("is ended once the deadline has passed and the goal is unmet (refunding campaign fixture)", () => {
      // refundingCampaign deadline is in the past (2026-07-31)
      const result = formatCampaignCard(
        { raised: refundRaised, goal: refundGoal, deadline: refundDeadline },
        { now },
      );
      expect(result.isEnded).toBe(true);
    });

    it("funded takes precedence — a funded campaign past its deadline is never ended", () => {
      const result = formatCampaignCard(
        { raised: fundedRaised, goal: fundedGoal, deadline: refundDeadline },
        { now },
      );
      expect(result.isFunded).toBe(true);
      expect(result.isEnded).toBe(false);
    });

    it("treats a missing deadline as never-ending (draft campaign fixture has no past deadline)", () => {
      const result = formatCampaignCard(
        { raised: zeroRaised, goal: zeroGoal },
        { now },
      );
      expect(result.isEnded).toBe(false);
    });

    it("treats an unparsable deadline as never-ending rather than throwing", () => {
      const result = formatCampaignCard(
        { raised: activeRaised, goal: activeGoal, deadline: "not-a-date" },
        { now },
      );
      expect(result.isEnded).toBe(false);
    });
  });

  describe("amount formatting", () => {
    it("uses locale-aware number formatting by default", () => {
      const result = formatCampaignCard({
        raised: activeRaised,
        goal: activeGoal,
      });
      expect(result.raisedText).toBe(
        activeRaised.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      );
      expect(result.goalText).toBe(
        activeGoal.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      );
    });

    it("appends the raised/goal labels when provided", () => {
      const result = formatCampaignCard(
        { raised: activeRaised, goal: activeGoal },
        { raisedLabel: "raised", goalLabel: "goal" },
      );
      expect(result.raisedText).toBe(
        `${activeRaised.toLocaleString(undefined, { maximumFractionDigits: 2 })} raised`,
      );
      expect(result.goalText).toBe(
        `${activeGoal.toLocaleString(undefined, { maximumFractionDigits: 2 })} goal`,
      );
    });

    it("delegates to a custom formatAmount (e.g. compact XLM notation)", () => {
      const formatAmount = (n: number) =>
        n >= 1_000_000_000
          ? `${(n / 1_000_000_000).toFixed(1)}B XLM`
          : `${n} XLM`;

      const result = formatCampaignCard(
        { raised: activeRaised, goal: activeGoal },
        { formatAmount },
      );
      expect(result.raisedText).toBe("4.5B XLM");
      expect(result.goalText).toBe("10.0B XLM");
    });

    it("handles a zero raised amount without throwing (draft campaign fixture)", () => {
      const result = formatCampaignCard({
        raised: zeroRaised,
        goal: zeroGoal,
      });
      expect(result.raisedText).toBe((0).toLocaleString());
      expect(result.isFunded).toBe(false);
    });
  });
});
