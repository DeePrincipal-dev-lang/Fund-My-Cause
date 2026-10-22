import { describe, it, expect } from "vitest";
import {
  isValidContractId,
  stripHtmlTags,
  validateTitle,
  validateDescription,
  validateGoal,
  validateContractId,
  validateVideoUrl,
  validateDeadline,
  validateMinContribution,
  validateMaxContribution,
  validateFeeBps,
  validateCampaignInput,
  validateDonationAmount,
  sanitizeTitle,
  sanitizeDescription,
} from "../validation";

describe("Validation Schemas & Utilities", () => {
  describe("isValidContractId & validateContractId", () => {
    it("should accept valid Stellar contract IDs", () => {
      const validId =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2";
      expect(isValidContractId(validId)).toBe(true);
      expect(validateContractId(validId)).toBeNull();
    });

    it("should reject contract IDs with incorrect length", () => {
      const shortId = "CAAAAAAAA";
      const longId =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA22";
      expect(isValidContractId(shortId)).toBe(false);
      expect(isValidContractId(longId)).toBe(false);
      expect(validateContractId(shortId)).toBe("Contract ID is invalid.");
    });

    it("should reject contract IDs that do not start with C", () => {
      const wrongStart =
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2";
      expect(isValidContractId(wrongStart)).toBe(false);
      expect(validateContractId(wrongStart)).toBe("Contract ID is invalid.");
    });

    it("should reject invalid base32 characters", () => {
      const invalidChars =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1"; // '1' is not base32
      expect(isValidContractId(invalidChars)).toBe(false);
      expect(validateContractId(invalidChars)).toBe("Contract ID is invalid.");
    });

    it("should reject empty/whitespace input for contract ID", () => {
      expect(validateContractId("")).toBe("Contract ID is required.");
      expect(validateContractId("   ")).toBe("Contract ID is required.");
    });
  });

  describe("stripHtmlTags", () => {
    it("should strip HTML tags correctly", () => {
      expect(stripHtmlTags("<p>Hello <strong>World</strong></p>")).toBe(
        "Hello World",
      );
      expect(stripHtmlTags("Plain Text")).toBe("Plain Text");
    });
  });

  describe("validateTitle & sanitizeTitle", () => {
    it("should accept valid titles", () => {
      expect(validateTitle("Valid Title")).toBeNull();
    });

    it("should reject empty titles", () => {
      expect(validateTitle("")).toBe("Title is required.");
      expect(validateTitle("   ")).toBe("Title is required.");
    });

    it("should reject titles exceeding 100 characters", () => {
      const longTitle = "a".repeat(101);
      expect(validateTitle(longTitle)).toBe(
        "Title must be 100 characters or less.",
      );
    });

    it("should enforce boundaries correctly", () => {
      const boundaryTitle = "a".repeat(100);
      expect(validateTitle(boundaryTitle)).toBeNull();
    });

    it("should sanitize titles by stripping HTML tags", () => {
      expect(sanitizeTitle("<h1>Title</h1> ")).toBe("Title");
    });
  });

  describe("validateDescription & sanitizeDescription", () => {
    it("should accept valid descriptions", () => {
      expect(
        validateDescription("This is a valid campaign description."),
      ).toBeNull();
    });

    it("should reject empty descriptions", () => {
      expect(validateDescription("")).toBe("Description is required.");
      expect(validateDescription("   ")).toBe("Description is required.");
    });

    it("should reject descriptions exceeding 1000 characters", () => {
      const longDesc = "a".repeat(1001);
      expect(validateDescription(longDesc)).toBe(
        "Description must be 1000 characters or less.",
      );
    });

    it("should enforce boundaries correctly", () => {
      const boundaryDesc = "a".repeat(1000);
      expect(validateDescription(boundaryDesc)).toBeNull();
    });

    it("should sanitize descriptions by stripping HTML tags", () => {
      expect(sanitizeDescription("<p>Desc</p>")).toBe("Desc");
    });
  });

  describe("validateGoal", () => {
    it("should accept valid positive numbers", () => {
      expect(validateGoal("1000")).toBeNull();
      expect(validateGoal("10.5")).toBeNull();
    });

    it("should reject empty or missing goals", () => {
      expect(validateGoal("")).toBe("Goal is required.");
      expect(validateGoal("   ")).toBe("Goal is required.");
    });

    it("should reject negative or zero goals", () => {
      expect(validateGoal("-50")).toBe("Goal must be a positive number.");
      expect(validateGoal("0")).toBe("Goal must be a positive number.");
      expect(validateGoal("abc")).toBe("Goal must be a positive number.");
    });

    it("should reject goals exceeding maximum allowed value", () => {
      // i128::MAX / 10 is 17014118346046923173168730371588410572
      // Goal input is multiplied by 10,000,000 (stroops)
      // Maximum goal in XLM is MAX_GOAL / 10,000,000
      const hugeGoal = "9223372036854775807";
      expect(validateGoal(hugeGoal)).toBe(
        "Goal exceeds maximum allowed value.",
      );
    });
  });

  describe("validateVideoUrl", () => {
    it("should return null for empty/optional video URL", () => {
      expect(validateVideoUrl("")).toBeNull();
      expect(validateVideoUrl("  ")).toBeNull();
    });

    it("should accept valid https URLs", () => {
      expect(validateVideoUrl("https://youtube.com/watch?v=123")).toBeNull();
      expect(validateVideoUrl("https://example.com/video.mp4")).toBeNull();
    });

    it("should reject non-https URLs", () => {
      expect(validateVideoUrl("http://example.com/video.mp4")).toBe(
        "Enter a valid URL starting with https://",
      );
    });

    it("should reject malformed URLs", () => {
      expect(validateVideoUrl("https://")).toBe("Enter a valid URL.");
    });
  });

  describe("validateDeadline", () => {
    it("should reject missing deadline", () => {
      expect(validateDeadline("")).toBe("Deadline is required.");
    });

    it("should accept deadlines within the allowed window (1 hour to 1 year)", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(validateDeadline(tomorrow.toISOString())).toBeNull();
    });

    it("should reject deadlines in the past or too close in the future", () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(validateDeadline(past.toISOString())).toBe(
        "Deadline must be at least 1 hour in the future.",
      );

      const justNow = new Date();
      expect(validateDeadline(justNow.toISOString())).toBe(
        "Deadline must be at least 1 hour in the future.",
      );
    });

    it("should reject deadlines more than 1 year in the future", () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);
      expect(validateDeadline(farFuture.toISOString())).toBe(
        "Deadline cannot be more than 1 year in the future.",
      );
    });
  });

  describe("validateMinContribution", () => {
    it("should accept valid minimum contributions", () => {
      expect(validateMinContribution("10", "1000")).toBeNull();
      expect(validateMinContribution("1", "1")).toBeNull();
    });

    it("should reject empty minimum contributions", () => {
      expect(validateMinContribution("", "100")).toBe(
        "Minimum contribution is required.",
      );
    });

    it("should reject minimum contributions less than 1", () => {
      expect(validateMinContribution("0.5", "100")).toBe(
        "Minimum contribution must be at least 1.",
      );
      expect(validateMinContribution("0", "100")).toBe(
        "Minimum contribution must be at least 1.",
      );
      expect(validateMinContribution("-5", "100")).toBe(
        "Minimum contribution must be at least 1.",
      );
      expect(validateMinContribution("abc", "100")).toBe(
        "Minimum contribution must be at least 1.",
      );
    });

    it("should reject minimum contributions exceeding the goal", () => {
      expect(validateMinContribution("150", "100")).toBe(
        "Minimum contribution cannot exceed goal.",
      );
    });
  });

  describe("validateMaxContribution", () => {
    it("should accept 0 or empty as no limit", () => {
      expect(validateMaxContribution("", "10")).toBeNull();
      expect(validateMaxContribution("0", "10")).toBeNull();
    });

    it("should accept valid maximum contributions", () => {
      expect(validateMaxContribution("50", "10")).toBeNull();
    });

    it("should reject negative maximum contributions", () => {
      expect(validateMaxContribution("-5", "10")).toBe(
        "Maximum contribution must be a non-negative number.",
      );
      expect(validateMaxContribution("abc", "10")).toBe(
        "Maximum contribution must be a non-negative number.",
      );
    });

    it("should reject maximum contributions less than minimum contribution", () => {
      expect(validateMaxContribution("5", "10")).toBe(
        "Maximum contribution cannot be less than minimum contribution.",
      );
    });
  });

  describe("validateFeeBps", () => {
    it("should accept empty platform fees as optional", () => {
      expect(validateFeeBps("")).toBeNull();
    });

    it("should accept valid basis points (0 to 10000)", () => {
      expect(validateFeeBps("250")).toBeNull();
      expect(validateFeeBps("0")).toBeNull();
      expect(validateFeeBps("10000")).toBeNull();
    });

    it("should reject out-of-range basis points", () => {
      expect(validateFeeBps("-1")).toBe(
        "Fee must be between 0 and 10000 basis points.",
      );
      expect(validateFeeBps("10001")).toBe(
        "Fee must be between 0 and 10000 basis points.",
      );
      expect(validateFeeBps("abc")).toBe(
        "Fee must be between 0 and 10000 basis points.",
      );
    });
  });

  describe("validateCampaignInput", () => {
    const validInput = {
      title: "A Great Cause",
      description: "A description of the cause worth funding.",
      goal: "1000",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      minContribution: "10",
    };

    it("should return an empty object for fully valid input", () => {
      expect(validateCampaignInput(validInput)).toEqual({});
    });

    it("should collect one error per invalid field, keyed by field name", () => {
      const errors = validateCampaignInput({
        title: "",
        description: "",
        goal: "",
        deadline: "",
        minContribution: "",
      });
      expect(Object.keys(errors).sort()).toEqual(
        ["deadline", "description", "goal", "minContribution", "title"].sort(),
      );
    });

    it("should not report errors for fields that are individually valid", () => {
      const errors = validateCampaignInput({ ...validInput, title: "" });
      expect(errors).toEqual({ title: "Title is required." });
    });
  });

  describe("validateDonationAmount", () => {
    it("should accept an amount at or above the minimum", () => {
      expect(validateDonationAmount("1")).toBeNull();
      expect(validateDonationAmount("100")).toBeNull();
    });

    it("should reject an empty amount", () => {
      expect(validateDonationAmount("")).toBe("Donation amount is required.");
    });

    it("should reject a non-numeric amount", () => {
      expect(validateDonationAmount("abc")).toBe(
        "Donation amount must be a positive number.",
      );
    });

    it("should reject zero or negative amounts", () => {
      expect(validateDonationAmount("0")).toBe(
        "Donation amount must be a positive number.",
      );
      expect(validateDonationAmount("-5")).toBe(
        "Donation amount must be a positive number.",
      );
    });

    it("should reject an amount below the minimum donation", () => {
      expect(validateDonationAmount("0.5")).toBe(
        "Donation amount must be at least 1 XLM.",
      );
    });
  });
});
