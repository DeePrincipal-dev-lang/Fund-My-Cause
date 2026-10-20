"use client";

import { useRef } from "react";

/** Checks one field's value. Returns an error message, or null when the value is valid. */
export type FieldValidator<T> = (value: string, data: T) => string | null;

export interface WizardStepFields<T> {
  /** The error to show for a field. Errors appear only once the field has a value. */
  errorFor: (field: keyof T) => string | null;
  /** True when the field now differs from the value the step was opened with. */
  isDirty: (field: keyof T) => boolean;
}

/**
 * Shared field validation and dirty tracking for wizard steps. Required-field checks still
 * run when the user presses Next; this hook only drives the as-you-type field errors.
 */
export function useWizardStep<T extends object>(
  data: T,
  validators: Partial<Record<keyof T, FieldValidator<T>>>,
): WizardStepFields<T> {
  const initial = useRef(data);

  return {
    errorFor: (field) => {
      const value = data[field];
      const validate = validators[field];
      return typeof value === "string" && value && validate ? validate(value, data) : null;
    },
    isDirty: (field) => data[field] !== initial.current[field],
  };
}
