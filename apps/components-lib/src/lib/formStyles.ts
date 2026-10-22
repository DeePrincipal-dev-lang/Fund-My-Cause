import { cn } from "./utils";

/** Default control styling shared by Input, Select and Textarea. */
export const CONTROL_BASE =
  "px-3 py-2 border rounded-lg text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed";

export interface ControlClassNameOptions {
  /** Skip the library defaults entirely so the caller's classes fully own the look. */
  unstyled?: boolean;
  hasError?: boolean;
  fullWidth?: boolean;
}

/**
 * Builds the class string for a form control.
 *
 * With `unstyled` only the width modifier is emitted, which lets an app supply
 * its own design-system classes without fighting tailwind-merge over defaults.
 */
export function controlClassName({
  unstyled = false,
  hasError = false,
  fullWidth = false,
}: ControlClassNameOptions): string {
  if (unstyled) return fullWidth ? "w-full" : "";

  return cn(
    CONTROL_BASE,
    hasError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-300",
    fullWidth && "w-full",
  );
}
