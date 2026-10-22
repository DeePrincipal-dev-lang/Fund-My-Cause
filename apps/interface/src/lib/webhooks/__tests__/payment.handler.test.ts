/**
 * Unit tests for payment handlers — Issue #1283
 *
 * Tests handler validation and dispatch logic for payment events.
 */

import {
  handleContributionReceived,
  handlePaymentEvent,
  PAYMENT_EVENTS,
  PaymentPayload,
} from "../handlers/payment";

describe("payment handlers", () => {
  const validPayload: PaymentPayload = {
    contributionId: "contrib-123",
    campaignId: "camp-456",
    contributorAddress: "G1234567890ABCDEF",
    amount: 100,
    currency: "USDC",
    transactionHash: "0x1234567890abcdef",
    timestamp: Date.now(),
  };

  describe("handleContributionReceived", () => {
    it("accepts valid contribution.received payload", () => {
      expect(() => handleContributionReceived(validPayload)).not.toThrow();
    });

    it("rejects payload without contributionId", () => {
      const invalid = { ...validPayload, contributionId: "" };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without contributorAddress", () => {
      const invalid = { ...validPayload, contributorAddress: "" };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without amount", () => {
      const invalid = { ...validPayload, amount: undefined };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects zero amount", () => {
      const invalid = { ...validPayload, amount: 0 };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "amount must be > 0",
      );
    });

    it("rejects negative amount", () => {
      const invalid = { ...validPayload, amount: -50 };
      expect(() => handleContributionReceived(invalid)).toThrow(
        "amount must be > 0",
      );
    });

    it("accepts positive amounts", () => {
      const payload1 = { ...validPayload, amount: 0.01 };
      const payload2 = { ...validPayload, amount: 1000000 };

      expect(() => handleContributionReceived(payload1)).not.toThrow();
      expect(() => handleContributionReceived(payload2)).not.toThrow();
    });

    it("accepts payload without optional transactionHash", () => {
      const payload = { ...validPayload };
      delete payload.transactionHash;
      expect(() => handleContributionReceived(payload)).not.toThrow();
    });
  });

  describe("handlePaymentEvent router", () => {
    it("routes contribution.received to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/payment"),
        "handleContributionReceived",
      );
      handlePaymentEvent("contribution.received", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("throws on unknown payment event type", () => {
      expect(() =>
        handlePaymentEvent("payment.unknown" as any, validPayload),
      ).toThrow("Unknown payment event type");
    });
  });

  describe("PAYMENT_EVENTS constant", () => {
    it("contains contribution.received event", () => {
      expect(PAYMENT_EVENTS.has("contribution.received")).toBe(true);
      expect(PAYMENT_EVENTS.size).toBe(1);
    });

    it("does not contain non-payment events", () => {
      expect(PAYMENT_EVENTS.has("campaign.created")).toBe(false);
      expect(PAYMENT_EVENTS.has("milestone.reached")).toBe(false);
    });
  });
});
