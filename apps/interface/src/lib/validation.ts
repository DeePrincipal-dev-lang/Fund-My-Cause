/**
 * Input validation and sanitization utilities for campaign creation.
 *
 * Field-level validators (title, description, goal, deadline, minContribution,
 * feeBps) are delegated to the shared @fund-my-cause/types package so the
 * frontend and backend always apply identical rules.
 *
 * Interface-specific helpers (isValidContractId, validateContractId,
 * sanitizeTitle, sanitizeDescription, validateVideoUrl,
 * validateMaxContribution) remain here.
 */

import {
  validateCampaignTitle,
  validateCampaignDescription,
  validateCampaignGoal,
  validateCampaignDeadline,
  validateMinContribution as sharedValidateMinContribution,
  validateFeeBps as sharedValidateFeeBps,
} from "@fund-my-cause/types";
import {
  optionalXlmCapSchema,
  firstSchemaError,
} from "@/lib/validationSchemas";
import { sanitizeText } from "@/lib/sanitize";

// Re-export shared constants for callers that import them from this module.
export {
  CAMPAIGN_TITLE_MAX_LENGTH,
  CAMPAIGN_DESCRIPTION_MAX_LENGTH,
  CAMPAIGN_DEADLINE_MIN_HOURS,
  CAMPAIGN_DEADLINE_MAX_YEARS,
  DONATION_MIN_XLM,
  XLM_TO_STROOPS,
} from "@fund-my-cause/types";

// ---------------------------------------------------------------------------
// Interface-specific helpers (not shared)
// ---------------------------------------------------------------------------

/**
 * Validate that a string is a valid Stellar contract ID.
 * Contract IDs start with 'C', are 56 characters long, and use valid base32 characters.
 */
export function isValidContractId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false;
  }
  if (!id.startsWith("C") || id.length !== 56) {
    return false;
  }
  const base32Regex = /^C[A-Z2-7]{55}$/;
  return base32Regex.test(id);
}

export function validateContractId(id: string): string | null {
  if (!id || !id.trim()) {
    return "Contract ID is required.";
  }
  if (!isValidContractId(id.trim())) {
    return "Contract ID is invalid.";
  }
  return null;
}

export function validateVideoUrl(videoUrl: string): string | null {
  if (!videoUrl || !videoUrl.trim()) {
    return null;
  }

  const trimmed = videoUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return "Enter a valid URL starting with https://";
  }

  try {
    new URL(trimmed);
    return null;
  } catch {
    return "Enter a valid URL.";
  }
}

/**
 * Validate maximum contribution per contributor.
 * A value of 0 means no limit. If set, must be >= minContribution.
 * Use case: prevents whale dominance by capping any single contributor's total pledge.
 * @returns Error message if invalid, null if valid
 */
export function validateMaxContribution(
  maxContribution: string,
  minContribution: string,
): string | null {
  const minNum = Number(minContribution);
  const min = !isNaN(minNum) && minNum > 0 ? minNum : 0;

  return firstSchemaError(
    optionalXlmCapSchema(min, {
      invalid: "Maximum contribution must be a non-negative number.",
      belowMinimum:
        "Maximum contribution cannot be less than minimum contribution.",
    }),
    maxContribution,
  );
}

/**
 * Sanitize title by stripping HTML tags (including script/style contents) and trimming.
 */
export function sanitizeTitle(title: string): string {
  return sanitizeText(title).trim();
}

/**
 * Sanitize description by stripping HTML tags (including script/style contents) and trimming.
 */
export function sanitizeDescription(description: string): string {
  return sanitizeText(description).trim();
}

// ---------------------------------------------------------------------------
// Delegated validators (backward-compatible wrappers around shared logic)
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize campaign title.
 * @returns Error message if invalid, null if valid
 */
export function validateTitle(title: string): string | null {
  return validateCampaignTitle(title);
}

/**
 * Validate and sanitize campaign description.
 * @returns Error message if invalid, null if valid
 */
export function validateDescription(description: string): string | null {
  return validateCampaignDescription(description);
}

/**
 * Validate funding goal.
 * @returns Error message if invalid, null if valid
 */
export function validateGoal(goal: string): string | null {
  return validateCampaignGoal(goal);
}

/**
 * Validate deadline.
 * @returns Error message if invalid, null if valid
 */
export function validateDeadline(deadline: string): string | null {
  return validateCampaignDeadline(deadline);
}

/**
 * Validate minimum contribution.
 * @returns Error message if invalid, null if valid
 */
export function validateMinContribution(
  minContribution: string,
  goal: string,
): string | null {
  return sharedValidateMinContribution(minContribution, goal);
}

/**
 * Validate platform fee in basis points.
 * @returns Error message if invalid, null if valid
 */
export function validateFeeBps(feeBps: string): string | null {
  return sharedValidateFeeBps(feeBps);
}
