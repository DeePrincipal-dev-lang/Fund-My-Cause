"use client";

import React, { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/utils";

/** Visual presentation variant for the Card component. */
export type CardVariant = "default" | "compact" | "highlighted";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Visual variant that controls the card's appearance.
   * - `default`     — standard card with medium padding and a subtle border.
   * - `compact`     — reduced padding for dense layouts (replaces the old `padding="sm"` pattern).
   * - `highlighted` — accented border and tinted background to draw attention.
   *
   * @default "default"
   */
  variant?: CardVariant;
  hoverable?: boolean;
  /**
   * @deprecated Use `variant="compact"` for compact padding or `variant="default"` for
   * standard padding. The `padding` prop will be removed in a future release.
   * When both `variant` and `padding` are set, `variant` takes precedence for
   * padding unless `padding` is explicitly provided.
   */
  padding?: "sm" | "md" | "lg";
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "bg-white border border-gray-200 shadow-sm p-4",
  compact: "bg-white border border-gray-200 shadow-sm p-3",
  highlighted: "bg-indigo-50 border-2 border-indigo-400 shadow-md p-4",
};

/**
 * Card component for content containers.
 *
 * Use the `variant` prop to control appearance:
 *
 * ```tsx
 * <Card variant="default">Standard content</Card>
 * <Card variant="compact">Dense layout</Card>
 * <Card variant="highlighted">Featured campaign</Card>
 * ```
 *
 * The legacy `padding` prop is still accepted for backwards compatibility but
 * `variant` is the preferred API going forward.
 */
export function Card({
  children,
  variant = "default",
  hoverable = false,
  padding,
  className,
  ...props
}: CardProps) {
  // When the caller still uses the legacy `padding` prop, honour it so
  // existing call-sites don't break. The variant's padding is overridden by
  // an explicit `padding` value.
  const legacyPaddingClass =
    padding === "sm" ? "p-3" : padding === "lg" ? "p-6" : null;

  // Start from the variant's base classes, then strip its padding token when
  // a legacy override is in effect.
  const baseClasses = legacyPaddingClass
    ? VARIANT_CLASSES[variant].replace(/\bp-\d+\b/, legacyPaddingClass)
    : VARIANT_CLASSES[variant];

  return (
    <div
      className={cn(
        "rounded-lg",
        baseClasses,
        hoverable && "hover:shadow-md transition-shadow cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card header component
 */
export function CardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 pb-4 border-b border-gray-200", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card body component
 */
export function CardBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card footer component
 */
export function CardFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 pt-4 border-t border-gray-200", className)}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
