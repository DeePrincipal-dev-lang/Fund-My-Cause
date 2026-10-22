"use client";

/**
 * Presentational form primitives shared by the campaign-wizard steps.
 * Kept separate from the steps themselves so each step file stays focused on
 * the fields it owns.
 */

import React from "react";
import { FormField } from "@fund-my-cause/components";
import {
  FORM_ERROR_CLS,
  FORM_FIELD_CLS,
  FORM_INPUT_CLS,
  FORM_LABEL_CLS,
} from "@/lib/formStyles";

/** Styling the steps hand to every shared form primitive. */
export const fieldStyles = {
  unstyled: true as const,
  className: FORM_INPUT_CLS,
  fieldClassName: FORM_FIELD_CLS,
  labelClassName: FORM_LABEL_CLS,
  errorClassName: FORM_ERROR_CLS,
};

/**
 * Label wrapper for controls the shared primitives don't cover (uploaders and
 * other composite widgets). Real inputs use `Input` / `Select` / `Textarea`.
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <FormField
      label={label}
      className={FORM_FIELD_CLS}
      labelClassName={FORM_LABEL_CLS}
    >
      {() => children}
    </FormField>
  );
}

/** A label/value row used by the review step's summary table. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-white max-w-xs truncate text-right">
        {value || "—"}
      </span>
    </div>
  );
}
