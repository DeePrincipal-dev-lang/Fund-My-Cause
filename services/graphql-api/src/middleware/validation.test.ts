import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import {
  validateCreateCampaignInput,
  validateRecordContributionInput,
  validateUpdateCampaignInput,
  validateAuthenticateInput,
} from "./validation.js";
import { XLM_TO_STROOPS } from "@fund-my-cause/types";

describe("Validation Middleware", () => {
  describe("validateCreateCampaignInput", () => {
    it("should pass with valid campaign input", () => {
      const validInput = {
        title: "Valid Campaign",
        description: "A valid campaign description",
        goal: "1000",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(validInput)).not.toThrow();
    });

    it("should throw error for missing title", () => {
      const invalidInput = {
        title: "",
        description: "A valid campaign description",
        goal: "1000",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for title exceeding max length", () => {
      const invalidInput = {
        title: "a".repeat(101),
        description: "A valid campaign description",
        goal: "1000",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing description", () => {
      const invalidInput = {
        title: "Valid Campaign",
        description: "",
        goal: "1000",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for negative goal", () => {
      const invalidInput = {
        title: "Valid Campaign",
        description: "A valid campaign description",
        goal: "-100",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for deadline in the past", () => {
      const invalidInput = {
        title: "Valid Campaign",
        description: "A valid campaign description",
        goal: "1000",
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "10",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error when minContribution exceeds goal", () => {
      const invalidInput = {
        title: "Valid Campaign",
        description: "A valid campaign description",
        goal: "100",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        minContribution: "1000",
      };

      expect(() => validateCreateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });
  });

  describe("validateRecordContributionInput", () => {
    it("should pass with valid contribution input", () => {
      const validInput = {
        campaignId: "1",
        contributor: "0x123456789",
        amount: BigInt(10) * XLM_TO_STROOPS,
        transactionHash: "0xabcdef123456",
      };

      expect(() => validateRecordContributionInput(validInput)).not.toThrow();
    });

    it("should throw error for missing campaignId", () => {
      const invalidInput = {
        campaignId: "",
        contributor: "0x123456789",
        amount: BigInt(10) * XLM_TO_STROOPS,
        transactionHash: "0xabcdef123456",
      };

      expect(() => validateRecordContributionInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing contributor", () => {
      const invalidInput = {
        campaignId: "1",
        contributor: "",
        amount: BigInt(10) * XLM_TO_STROOPS,
        transactionHash: "0xabcdef123456",
      };

      expect(() => validateRecordContributionInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing amount", () => {
      const invalidInput = {
        campaignId: "1",
        contributor: "0x123456789",
        amount: undefined,
        transactionHash: "0xabcdef123456",
      };

      expect(() => validateRecordContributionInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing transactionHash", () => {
      const invalidInput = {
        campaignId: "1",
        contributor: "0x123456789",
        amount: BigInt(10) * XLM_TO_STROOPS,
        transactionHash: "",
      };

      expect(() => validateRecordContributionInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for amount below minimum", () => {
      const invalidInput = {
        campaignId: "1",
        contributor: "0x123456789",
        amount: BigInt(0.5) * XLM_TO_STROOPS, // Less than 1 XLM
        transactionHash: "0xabcdef123456",
      };

      expect(() => validateRecordContributionInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });
  });

  describe("validateUpdateCampaignInput", () => {
    it("should pass with valid update input", () => {
      const validInput = {
        title: "Updated Campaign",
        description: "Updated description",
        image: "https://example.com/image.jpg",
        videoUrl: "https://example.com/video.mp4",
      };

      expect(() => validateUpdateCampaignInput(validInput)).not.toThrow();
    });

    it("should pass with empty update input (all optional)", () => {
      const validInput = {};

      expect(() => validateUpdateCampaignInput(validInput)).not.toThrow();
    });

    it("should throw error for empty title", () => {
      const invalidInput = {
        title: "",
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for title exceeding max length", () => {
      const invalidInput = {
        title: "a".repeat(101),
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for description exceeding max length", () => {
      const invalidInput = {
        description: "a".repeat(1001),
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for invalid image URL", () => {
      const invalidInput = {
        image: "not-a-url",
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for video URL without https", () => {
      const invalidInput = {
        videoUrl: "http://example.com/video.mp4",
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for invalid video URL", () => {
      const invalidInput = {
        videoUrl: "https://invalid url with spaces",
      };

      expect(() => validateUpdateCampaignInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });
  });

  describe("validateAuthenticateInput", () => {
    it("should pass with valid authenticate input", () => {
      const validInput = {
        signature: "0xsignature",
        message: "Sign this message",
        address: "0x123456789",
      };

      expect(() => validateAuthenticateInput(validInput)).not.toThrow();
    });

    it("should throw error for missing signature", () => {
      const invalidInput = {
        signature: "",
        message: "Sign this message",
        address: "0x123456789",
      };

      expect(() => validateAuthenticateInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing message", () => {
      const invalidInput = {
        signature: "0xsignature",
        message: "",
        address: "0x123456789",
      };

      expect(() => validateAuthenticateInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });

    it("should throw error for missing address", () => {
      const invalidInput = {
        signature: "0xsignature",
        message: "Sign this message",
        address: "",
      };

      expect(() => validateAuthenticateInput(invalidInput)).toThrow(
        GraphQLError,
      );
    });
  });
});
