/**
 * Unit tests for campaign handlers — Issue #1283
 *
 * Tests handler validation and dispatch logic for campaign events.
 */

import {
  handleCampaignCreated,
  handleCampaignUpdated,
  handleCampaignFunded,
  handleCampaignSuccessful,
  handleCampaignCancelled,
  handleCampaignEvent,
  CAMPAIGN_EVENTS,
  CampaignPayload,
} from "../handlers/campaign";

describe("campaign handlers", () => {
  const validPayload: CampaignPayload = {
    campaignId: "camp-123",
    title: "Test Campaign",
    ownerAddress: "G1234567890ABCDEF",
    targetAmount: 1000,
    currentAmount: 500,
    status: "active",
    timestamp: Date.now(),
  };

  describe("handleCampaignCreated", () => {
    it("accepts valid campaign.created payload", () => {
      expect(() => handleCampaignCreated(validPayload)).not.toThrow();
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleCampaignCreated(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without ownerAddress", () => {
      const invalid = { ...validPayload, ownerAddress: "" };
      expect(() => handleCampaignCreated(invalid)).toThrow(
        "missing required fields",
      );
    });
  });

  describe("handleCampaignUpdated", () => {
    it("accepts valid campaign.updated payload", () => {
      expect(() => handleCampaignUpdated(validPayload)).not.toThrow();
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleCampaignUpdated(invalid)).toThrow();
    });
  });

  describe("handleCampaignFunded", () => {
    it("accepts valid campaign.funded payload", () => {
      expect(() => handleCampaignFunded(validPayload)).not.toThrow();
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleCampaignFunded(invalid)).toThrow();
    });

    it("rejects payload without currentAmount", () => {
      const invalid = { ...validPayload, currentAmount: undefined };
      expect(() => handleCampaignFunded(invalid)).toThrow(
        "missing required fields",
      );
    });
  });

  describe("handleCampaignSuccessful", () => {
    it("accepts valid campaign.successful payload", () => {
      expect(() => handleCampaignSuccessful(validPayload)).not.toThrow();
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleCampaignSuccessful(invalid)).toThrow();
    });
  });

  describe("handleCampaignCancelled", () => {
    it("accepts valid campaign.cancelled payload", () => {
      expect(() => handleCampaignCancelled(validPayload)).not.toThrow();
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleCampaignCancelled(invalid)).toThrow();
    });
  });

  describe("handleCampaignEvent router", () => {
    it("routes campaign.created to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/campaign"),
        "handleCampaignCreated",
      );
      handleCampaignEvent("campaign.created", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("routes campaign.updated to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/campaign"),
        "handleCampaignUpdated",
      );
      handleCampaignEvent("campaign.updated", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("routes campaign.funded to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/campaign"),
        "handleCampaignFunded",
      );
      handleCampaignEvent("campaign.funded", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("routes campaign.successful to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/campaign"),
        "handleCampaignSuccessful",
      );
      handleCampaignEvent("campaign.successful", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("routes campaign.cancelled to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/campaign"),
        "handleCampaignCancelled",
      );
      handleCampaignEvent("campaign.cancelled", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("throws on unknown campaign event type", () => {
      expect(() =>
        handleCampaignEvent("campaign.unknown" as any, validPayload),
      ).toThrow("Unknown campaign event type");
    });
  });

  describe("CAMPAIGN_EVENTS constant", () => {
    it("contains all campaign event types", () => {
      expect(CAMPAIGN_EVENTS.has("campaign.created")).toBe(true);
      expect(CAMPAIGN_EVENTS.has("campaign.updated")).toBe(true);
      expect(CAMPAIGN_EVENTS.has("campaign.funded")).toBe(true);
      expect(CAMPAIGN_EVENTS.has("campaign.successful")).toBe(true);
      expect(CAMPAIGN_EVENTS.has("campaign.cancelled")).toBe(true);
      expect(CAMPAIGN_EVENTS.size).toBe(5);
    });

    it("does not contain non-campaign events", () => {
      expect(CAMPAIGN_EVENTS.has("contribution.received")).toBe(false);
      expect(CAMPAIGN_EVENTS.has("milestone.reached")).toBe(false);
    });
  });
});
