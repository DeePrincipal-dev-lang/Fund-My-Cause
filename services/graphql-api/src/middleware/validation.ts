import { GraphQLError } from "graphql";
import type { IResolvers } from "@graphql-tools/utils";
import {
  validateCampaignInput,
  validateDonationAmount,
  XLM_TO_STROOPS,
} from "@fund-my-cause/types";
import type { Context } from "../types.js";

/**
 * Standardized validation error structure
 */
export interface ValidationErrorResult {
  code: string;
  message: string;
  validationErrors: Record<string, string>;
}

/**
 * Validates campaign creation input
 * @throws GraphQLError with standardized validation errors
 */
export function validateCreateCampaignInput(input: any): void {
  const validationErrors = validateCampaignInput({
    title: input.title,
    description: input.description,
    goal: input.goal?.toString() ?? "",
    deadline: input.deadline,
    minContribution: input.minContribution?.toString() ?? "",
  });

  if (Object.keys(validationErrors).length > 0) {
    throw new GraphQLError("Invalid campaign input", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors,
      },
    });
  }
}

/**
 * Validates contribution amount input
 * @throws GraphQLError if validation fails
 */
export function validateRecordContributionInput(input: any): void {
  // Validate required fields
  if (!input.campaignId) {
    throw new GraphQLError("Campaign ID is required", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors: { campaignId: "Campaign ID is required" },
      },
    });
  }

  if (!input.contributor) {
    throw new GraphQLError("Contributor address is required", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors: { contributor: "Contributor address is required" },
      },
    });
  }

  if (!input.amount) {
    throw new GraphQLError("Contribution amount is required", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors: { amount: "Contribution amount is required" },
      },
    });
  }

  if (!input.transactionHash) {
    throw new GraphQLError("Transaction hash is required", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors: {
          transactionHash: "Transaction hash is required",
        },
      },
    });
  }

  // Validate amount using the shared validation function
  const amountXlm = input.amount
    ? (Number(input.amount) / Number(XLM_TO_STROOPS)).toString()
    : "0";
  const amountError = validateDonationAmount(amountXlm);
  if (amountError) {
    throw new GraphQLError(amountError, {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors: { amount: amountError },
      },
    });
  }
}

/**
 * Validates update campaign input
 * @throws GraphQLError with standardized validation errors
 */
export function validateUpdateCampaignInput(input: any): void {
  const validationErrors: Record<string, string> = {};

  // Title is optional, but validate if provided
  if (input.title !== undefined) {
    if (!input.title || input.title.trim() === "") {
      validationErrors.title = "Title cannot be empty";
    } else if (input.title.length > 100) {
      validationErrors.title = "Title must be 100 characters or less";
    }
  }

  // Description is optional, but validate if provided
  if (input.description !== undefined) {
    if (input.description && input.description.length > 1000) {
      validationErrors.description =
        "Description must be 1000 characters or less";
    }
  }

  // Image URL validation if provided
  if (input.image !== undefined && input.image) {
    try {
      new URL(input.image);
    } catch {
      validationErrors.image = "Invalid image URL";
    }
  }

  // Video URL validation if provided
  if (input.videoUrl !== undefined && input.videoUrl) {
    if (!/^https:\/\//i.test(input.videoUrl.trim())) {
      validationErrors.videoUrl = "Video URL must start with https://";
    } else {
      try {
        new URL(input.videoUrl);
      } catch {
        validationErrors.videoUrl = "Invalid video URL";
      }
    }
  }

  if (Object.keys(validationErrors).length > 0) {
    throw new GraphQLError("Invalid campaign update input", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors,
      },
    });
  }
}

/**
 * Validates authenticate input
 * @throws GraphQLError with standardized validation errors
 */
export function validateAuthenticateInput(input: any): void {
  const validationErrors: Record<string, string> = {};

  if (!input.signature || input.signature.trim() === "") {
    validationErrors.signature = "Signature is required";
  }

  if (!input.message || input.message.trim() === "") {
    validationErrors.message = "Message is required";
  }

  if (!input.address || input.address.trim() === "") {
    validationErrors.address = "Address is required";
  }

  if (Object.keys(validationErrors).length > 0) {
    throw new GraphQLError("Invalid authentication input", {
      extensions: {
        code: "BAD_USER_INPUT",
        validationErrors,
      },
    });
  }
}
