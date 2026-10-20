/**
 * Campaign progress utilities.
 *
 * Canonical implementations live in @fund-my-cause/shared-utils.
 * This file re-exports them for backward compatibility.
 */
export {
  calculateProgress as calculateCampaignProgress,
  isCampaignEnded as calculateIsEnded,
} from "@fund-my-cause/shared-utils";
