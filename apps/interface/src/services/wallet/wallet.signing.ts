/**
 * Wallet signing error classification (#1575).
 *
 * The wallet service does not perform signing itself — that happens in the
 * wallet hook. This module exposes the error-classification primitive so
 * callers can consistently map sign failures to a `SignErrorKind`.
 */
import {
  classifySignError,
  type SignErrorKind,
} from "@fund-my-cause/sdk/wallet";

export { classifySignError };
export type { SignErrorKind };
