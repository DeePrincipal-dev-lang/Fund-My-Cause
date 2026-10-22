import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts (e.g. a caller's `p-8`
 * overriding a default `p-4`) instead of leaving both classes in the DOM.
 *
 * `clsx` and `tailwind-merge` were already declared dependencies but were
 * unused — every component composed classes with a plain filter+join, so a
 * caller-supplied `className` could never reliably override a component's
 * own conflicting utility classes.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(...classes));
}
