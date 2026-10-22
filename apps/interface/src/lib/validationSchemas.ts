/**
 * Shared amount-validation schema.
 *
 * The pledge (contribution) form and the campaign-creation wizard's
 * contribution-amount fields all ask the same underlying question for a
 * string amount input — "is this a valid, positive XLM amount, at least
 * `min`?" — and each re-implemented the parse/required/positive/minimum
 * checks inline instead of sharing one rule set. This is that one place.
 *
 * Messages stay caller-supplied: the pledge form renders localized copy via
 * `next-intl`, while other callers can keep matching whatever plain-text
 * message their existing consumers expect. The schema owns the structure
 * (what counts as valid) rather than the copy.
 */

import { z } from "zod";

export interface XlmAmountMessages {
  /** Shown when the value is empty, not a number, or not positive. */
  invalid: string;
  /** Shown when the value is a valid positive number below `min`. */
  belowMinimum: string;
}

/** A required, positive XLM amount (given as a string), no smaller than `min`. */
export function xlmAmountSchema(min: number, messages: XlmAmountMessages) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    const amount = trimmed === "" ? NaN : Number(trimmed);

    if (trimmed === "" || Number.isNaN(amount) || amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.invalid });
      return;
    }

    if (amount < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages.belowMinimum,
      });
    }
  });
}

/**
 * An optional per-contributor cap: empty or `"0"` means "no limit"; otherwise
 * the value must be a non-negative number no smaller than `min`.
 */
export function optionalXlmCapSchema(
  min: number,
  messages: { invalid: string; belowMinimum: string },
) {
  const isUnset = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "0";
  };

  return z.string().superRefine((value, ctx) => {
    if (isUnset(value)) return;

    const amount = Number(value.trim());
    if (Number.isNaN(amount) || amount < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.invalid });
      return;
    }

    if (amount < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages.belowMinimum,
      });
    }
  });
}

/** Runs a schema and returns the first issue's message, or null when valid. */
export function firstSchemaError(
  schema: z.ZodTypeAny,
  value: unknown,
): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? null);
}
