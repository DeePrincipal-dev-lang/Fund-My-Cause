/**
 * Centralized error handling utilities for Fund-My-Cause.
 *
 * Usage:
 *   import { toAppError, getUserMessage, ErrorCode } from "@/lib/errors";
 *
 *   try { ... } catch (err) {
 *     const appError = toAppError(err);
 *     showToast(getUserMessage(appError));
 *   }
 */

// ── Error codes ───────────────────────────────────────────────────────────────

export enum ErrorCode {
  // Contract errors
  CONTRACT_NOT_INITIALIZED = "CONTRACT_NOT_INITIALIZED",
  CONTRACT_ALREADY_INITIALIZED = "CONTRACT_ALREADY_INITIALIZED",
  CONTRACT_GOAL_NOT_REACHED = "CONTRACT_GOAL_NOT_REACHED",
  CONTRACT_GOAL_REACHED = "CONTRACT_GOAL_REACHED",
  CONTRACT_CAMPAIGN_ENDED = "CONTRACT_CAMPAIGN_ENDED",
  CONTRACT_CAMPAIGN_ACTIVE = "CONTRACT_CAMPAIGN_ACTIVE",
  CONTRACT_CAMPAIGN_PAUSED = "CONTRACT_CAMPAIGN_PAUSED",
  CONTRACT_NOT_ACTIVE = "CONTRACT_NOT_ACTIVE",
  CONTRACT_BELOW_MINIMUM = "CONTRACT_BELOW_MINIMUM",
  CONTRACT_EXCEEDS_MAXIMUM = "CONTRACT_EXCEEDS_MAXIMUM",
  // #702: distinct per-contributor cap error
  CONTRACT_CONTRIBUTOR_CAP_EXCEEDED = "CONTRACT_CONTRIBUTOR_CAP_EXCEEDED",
  CONTRACT_INVALID_DEADLINE = "CONTRACT_INVALID_DEADLINE",
  CONTRACT_INVALID_GOAL = "CONTRACT_INVALID_GOAL",
  CONTRACT_INVALID_FEE = "CONTRACT_INVALID_FEE",
  CONTRACT_TOKEN_NOT_ACCEPTED = "CONTRACT_TOKEN_NOT_ACCEPTED",
  CONTRACT_OVERFLOW = "CONTRACT_OVERFLOW",
  CONTRACT_CALL_FAILED = "CONTRACT_CALL_FAILED",
  // #705: more granular errors
  CONTRACT_WRONG_STATE = "CONTRACT_WRONG_STATE",
  CONTRACT_DEADLINE_NOT_REACHED = "CONTRACT_DEADLINE_NOT_REACHED",
  CONTRACT_NO_CONTRIBUTION_TO_REFUND = "CONTRACT_NO_CONTRIBUTION_TO_REFUND",
  CONTRACT_ALREADY_WITHDRAWN = "CONTRACT_ALREADY_WITHDRAWN",
  CONTRACT_NOT_WHITELISTED = "CONTRACT_NOT_WHITELISTED",
  CONTRACT_BLACKLISTED = "CONTRACT_BLACKLISTED",
  CONTRACT_RATE_LIMIT_EXCEEDED = "CONTRACT_RATE_LIMIT_EXCEEDED",
  // #704: streaming errors
  CONTRACT_STREAM_NOT_CONFIGURED = "CONTRACT_STREAM_NOT_CONFIGURED",
  CONTRACT_STREAM_NOT_YET_CLAIMABLE = "CONTRACT_STREAM_NOT_YET_CLAIMABLE",
  CONTRACT_STREAM_FULLY_CLAIMED = "CONTRACT_STREAM_FULLY_CLAIMED",
  // Network errors
  NETWORK_REQUEST_FAILED = "NETWORK_REQUEST_FAILED",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_RPC_ERROR = "NETWORK_RPC_ERROR",
  NETWORK_TX_FAILED = "NETWORK_TX_FAILED",
  NETWORK_TX_TIMEOUT = "NETWORK_TX_TIMEOUT",
  // Wallet errors
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  WALLET_REJECTED = "WALLET_REJECTED",
  WALLET_INSUFFICIENT_FUNDS = "WALLET_INSUFFICIENT_FUNDS",
  WALLET_SIGN_FAILED = "WALLET_SIGN_FAILED",
  // Validation errors
  VALIDATION_INVALID_ADDRESS = "VALIDATION_INVALID_ADDRESS",
  VALIDATION_INVALID_AMOUNT = "VALIDATION_INVALID_AMOUNT",
  // Unknown
  UNKNOWN = "UNKNOWN",
}

// ── Severity levels ───────────────────────────────────────────────────────────

export type ErrorSeverity = "fatal" | "error" | "warning" | "info";

const SEVERITY_MAP: Partial<Record<ErrorCode, ErrorSeverity>> = {
  [ErrorCode.CONTRACT_OVERFLOW]: "fatal",
  [ErrorCode.NETWORK_TX_FAILED]: "error",
  [ErrorCode.NETWORK_TX_TIMEOUT]: "warning",
  [ErrorCode.WALLET_REJECTED]: "info",
  [ErrorCode.WALLET_NOT_CONNECTED]: "info",
  [ErrorCode.CONTRACT_CAMPAIGN_PAUSED]: "warning",
  [ErrorCode.CONTRACT_CAMPAIGN_ENDED]: "warning",
  [ErrorCode.CONTRACT_GOAL_REACHED]: "info",
  [ErrorCode.CONTRACT_GOAL_NOT_REACHED]: "info",
};

// ── User-friendly messages ────────────────────────────────────────────────────

const USER_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.CONTRACT_NOT_INITIALIZED]:
    "This campaign has not been set up yet.",
  [ErrorCode.CONTRACT_ALREADY_INITIALIZED]:
    "This campaign has already been initialized.",
  [ErrorCode.CONTRACT_GOAL_NOT_REACHED]:
    "The funding goal has not been reached yet.",
  [ErrorCode.CONTRACT_GOAL_REACHED]:
    "The funding goal has already been reached.",
  [ErrorCode.CONTRACT_CAMPAIGN_ENDED]: "This campaign has ended.",
  [ErrorCode.CONTRACT_CAMPAIGN_ACTIVE]: "This campaign is still active.",
  [ErrorCode.CONTRACT_CAMPAIGN_PAUSED]: "This campaign is currently paused.",
  [ErrorCode.CONTRACT_NOT_ACTIVE]: "This campaign is not active.",
  [ErrorCode.CONTRACT_BELOW_MINIMUM]:
    "Your contribution is below the minimum amount.",
  [ErrorCode.CONTRACT_EXCEEDS_MAXIMUM]:
    "Your contribution exceeds the maximum allowed amount.",
  [ErrorCode.CONTRACT_CONTRIBUTOR_CAP_EXCEEDED]:
    "Your total contributions would exceed the per-contributor cap for this campaign.",
  [ErrorCode.CONTRACT_INVALID_DEADLINE]: "The campaign deadline is invalid.",
  [ErrorCode.CONTRACT_INVALID_GOAL]: "The campaign goal is invalid.",
  [ErrorCode.CONTRACT_INVALID_FEE]:
    "The platform fee configuration is invalid.",
  [ErrorCode.CONTRACT_TOKEN_NOT_ACCEPTED]:
    "This token is not accepted by the campaign.",
  [ErrorCode.CONTRACT_OVERFLOW]:
    "A calculation error occurred. Please try again.",
  [ErrorCode.CONTRACT_CALL_FAILED]:
    "The contract call failed. Please try again.",
  [ErrorCode.CONTRACT_WRONG_STATE]:
    "The campaign is not in the right state for this action.",
  [ErrorCode.CONTRACT_DEADLINE_NOT_REACHED]:
    "The campaign deadline has not passed yet.",
  [ErrorCode.CONTRACT_NO_CONTRIBUTION_TO_REFUND]:
    "You have no contribution to refund for this campaign.",
  [ErrorCode.CONTRACT_ALREADY_WITHDRAWN]:
    "The campaign funds have already been withdrawn.",
  [ErrorCode.CONTRACT_NOT_WHITELISTED]:
    "Your address is not on the whitelist for this campaign.",
  [ErrorCode.CONTRACT_BLACKLISTED]:
    "Your address has been blocked from contributing to this campaign.",
  [ErrorCode.CONTRACT_RATE_LIMIT_EXCEEDED]:
    "You are contributing too fast. Please wait before trying again.",
  [ErrorCode.CONTRACT_STREAM_NOT_CONFIGURED]:
    "No streaming schedule has been configured for this campaign.",
  [ErrorCode.CONTRACT_STREAM_NOT_YET_CLAIMABLE]:
    "The streaming release has not started yet.",
  [ErrorCode.CONTRACT_STREAM_FULLY_CLAIMED]:
    "All streamed funds have already been claimed.",
  [ErrorCode.NETWORK_REQUEST_FAILED]:
    "Network request failed. Check your connection.",
  [ErrorCode.NETWORK_TIMEOUT]: "The request timed out. Please try again.",
  [ErrorCode.NETWORK_RPC_ERROR]:
    "Could not reach the Stellar network. Please try again.",
  [ErrorCode.NETWORK_TX_FAILED]:
    "Your transaction failed on-chain. Please try again.",
  [ErrorCode.NETWORK_TX_TIMEOUT]:
    "Transaction confirmation timed out. Check your wallet for status.",
  [ErrorCode.WALLET_NOT_CONNECTED]: "Please connect your wallet to continue.",
  [ErrorCode.WALLET_REJECTED]: "Transaction was rejected in your wallet.",
  [ErrorCode.WALLET_INSUFFICIENT_FUNDS]: "Insufficient funds in your wallet.",
  [ErrorCode.WALLET_SIGN_FAILED]:
    "Failed to sign the transaction. Please try again.",
  [ErrorCode.VALIDATION_INVALID_ADDRESS]: "The Stellar address is invalid.",
  [ErrorCode.VALIDATION_INVALID_AMOUNT]: "Please enter a valid amount.",
  [ErrorCode.UNKNOWN]: "An unexpected error occurred. Please try again.",
};

// ── AppError class ────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly originalError?: unknown;

  constructor(code: ErrorCode, message?: string, originalError?: unknown) {
    super(message ?? USER_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.severity = SEVERITY_MAP[code] ?? "error";
    this.originalError = originalError;
  }
}

// ── Error transformation ──────────────────────────────────────────────────────

/** Maps raw contract error message fragments to ErrorCodes. */
const CONTRACT_ERROR_PATTERNS: Array<[RegExp, ErrorCode]> = [
  [/AlreadyInitialized/i, ErrorCode.CONTRACT_ALREADY_INITIALIZED],
  [/CampaignEnded/i, ErrorCode.CONTRACT_CAMPAIGN_ENDED],
  [/CampaignStillActive/i, ErrorCode.CONTRACT_CAMPAIGN_ACTIVE],
  [/CampaignPaused/i, ErrorCode.CONTRACT_CAMPAIGN_PAUSED],
  [/GoalNotReached/i, ErrorCode.CONTRACT_GOAL_NOT_REACHED],
  [/GoalReached/i, ErrorCode.CONTRACT_GOAL_REACHED],
  [/NotActive/i, ErrorCode.CONTRACT_NOT_ACTIVE],
  [/BelowMinimum/i, ErrorCode.CONTRACT_BELOW_MINIMUM],
  // #702: ContributorCapExceeded must come before ExceedsMaximum
  [/ContributorCapExceeded/i, ErrorCode.CONTRACT_CONTRIBUTOR_CAP_EXCEEDED],
  [/ExceedsMaximum/i, ErrorCode.CONTRACT_EXCEEDS_MAXIMUM],
  [/InvalidDeadline/i, ErrorCode.CONTRACT_INVALID_DEADLINE],
  [/InvalidGoal/i, ErrorCode.CONTRACT_INVALID_GOAL],
  [/InvalidFee/i, ErrorCode.CONTRACT_INVALID_FEE],
  [/TokenNotAccepted/i, ErrorCode.CONTRACT_TOKEN_NOT_ACCEPTED],
  [/Overflow/i, ErrorCode.CONTRACT_OVERFLOW],
  // #705: granular errors
  [/WrongCampaignState/i, ErrorCode.CONTRACT_WRONG_STATE],
  [/DeadlineNotReached/i, ErrorCode.CONTRACT_DEADLINE_NOT_REACHED],
  [/NoContributionToRefund/i, ErrorCode.CONTRACT_NO_CONTRIBUTION_TO_REFUND],
  [/AlreadyWithdrawn/i, ErrorCode.CONTRACT_ALREADY_WITHDRAWN],
  [/NotWhitelisted/i, ErrorCode.CONTRACT_NOT_WHITELISTED],
  [/Blacklisted/i, ErrorCode.CONTRACT_BLACKLISTED],
  [/RateLimitExceeded/i, ErrorCode.CONTRACT_RATE_LIMIT_EXCEEDED],
  // #704: streaming errors
  [/StreamNotConfigured/i, ErrorCode.CONTRACT_STREAM_NOT_CONFIGURED],
  [/StreamNotYetClaimable/i, ErrorCode.CONTRACT_STREAM_NOT_YET_CLAIMABLE],
  [/StreamFullyClaimed/i, ErrorCode.CONTRACT_STREAM_FULLY_CLAIMED],
  [/HostError|contract/i, ErrorCode.CONTRACT_CALL_FAILED],
];

function classifyContractError(message: string): ErrorCode {
  for (const [pattern, code] of CONTRACT_ERROR_PATTERNS) {
    if (pattern.test(message)) return code;
  }
  return ErrorCode.CONTRACT_CALL_FAILED;
}

function classifyNetworkError(message: string): ErrorCode {
  if (/timeout|timed out/i.test(message)) return ErrorCode.NETWORK_TIMEOUT;
  if (/not confirmed after polling/i.test(message))
    return ErrorCode.NETWORK_TX_TIMEOUT;
  if (/transaction failed on-chain/i.test(message))
    return ErrorCode.NETWORK_TX_FAILED;
  if (/submit failed|rpc|network/i.test(message))
    return ErrorCode.NETWORK_RPC_ERROR;
  return ErrorCode.NETWORK_REQUEST_FAILED;
}

function classifyWalletError(message: string): ErrorCode {
  if (/not connected|no wallet/i.test(message))
    return ErrorCode.WALLET_NOT_CONNECTED;
  if (/rejected|denied|cancelled/i.test(message))
    return ErrorCode.WALLET_REJECTED;
  if (/insufficient|balance/i.test(message))
    return ErrorCode.WALLET_INSUFFICIENT_FUNDS;
  return ErrorCode.WALLET_SIGN_FAILED;
}

/** Returns true if the message looks like a wallet/signing error. */
export function isWalletError(message: string): boolean {
  return /wallet|freighter|sign|rejected|denied|insufficient|balance/i.test(
    message,
  );
}

/**
 * Transforms any thrown value into a typed AppError.
 *
 * @example
 * try { await contribute(...) } catch (err) {
 *   throw toAppError(err);
 * }
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof Error) {
    const msg = err.message;

    // Already-classified ContractError from contract.ts
    if (err.name === "ContractError") {
      return new AppError(classifyContractError(msg), msg, err);
    }

    // Network / fetch errors
    if (
      err.name === "TypeError" ||
      /fetch|network|rpc|submit|transaction/i.test(msg)
    ) {
      return new AppError(classifyNetworkError(msg), msg, err);
    }

    // Wallet errors
    if (
      /wallet|freighter|sign|rejected|denied|insufficient|balance/i.test(msg)
    ) {
      return new AppError(classifyWalletError(msg), msg, err);
    }

    // Validation errors
    if (/invalid.*address/i.test(msg)) {
      return new AppError(ErrorCode.VALIDATION_INVALID_ADDRESS, msg, err);
    }
    if (/invalid.*amount/i.test(msg)) {
      return new AppError(ErrorCode.VALIDATION_INVALID_AMOUNT, msg, err);
    }
  }

  return new AppError(ErrorCode.UNKNOWN, undefined, err);
}

/**
 * Returns the user-facing message for an AppError.
 */
export function getUserMessage(err: AppError): string {
  return USER_MESSAGES[err.code] ?? USER_MESSAGES[ErrorCode.UNKNOWN];
}
