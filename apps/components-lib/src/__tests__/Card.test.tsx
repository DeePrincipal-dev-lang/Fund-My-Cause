/**
 * Card component tests — variant prop API (#1117)
 *
 * Verifies that the `variant` union prop is the single source of truth for
 * Card's visual presentation, replacing the ad-hoc boolean/padding approach.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardBody, CardFooter } from "../Card";
import type { CardVariant } from "../Card";

// ── Type-level assertion ───────────────────────────────────────────────────
// Compile-time check: CardVariant must be a union of these three strings.
const _variants: CardVariant[] = ["default", "compact", "highlighted"];
void _variants;

// ── Variant rendering ──────────────────────────────────────────────────────

describe("Card variant prop API", () => {
  it('renders default variant when no variant is specified', () => {
    const { container } = render(<Card>Content</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain("border-gray-200");
    expect(el.className).not.toContain("border-indigo");
  });

  it('renders default variant explicitly', () => {
    const { container } = render(<Card variant="default">Content</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("border-gray-200");
    expect(el.className).toContain("p-4");
  });

  it('renders compact variant with reduced padding', () => {
    const { container } = render(<Card variant="compact">Compact</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-3");
    expect(el.className).toContain("border-gray-200");
    expect(el.className).not.toContain("p-4");
  });

  it('renders highlighted variant with accent border and background', () => {
    const { container } = render(<Card variant="highlighted">Featured</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("border-indigo-400");
    expect(el.className).toContain("bg-indigo-50");
  });

  it('renders all three variants without throwing', () => {
    const variants: CardVariant[] = ["default", "compact", "highlighted"];
    for (const variant of variants) {
      expect(() =>
        render(<Card variant={variant}>Test</Card>),
      ).not.toThrow();
    }
  });
});

// ── Backwards compatibility ────────────────────────────────────────────────

describe("Card legacy padding prop (backwards compatibility)", () => {
  it('legacy padding="sm" still produces p-3 class', () => {
    const { container } = render(<Card padding="sm">Old API</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-3");
  });

  it('legacy padding="lg" still produces p-6 class', () => {
    const { container } = render(<Card padding="lg">Old API</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-6");
  });

  it('variant takes precedence when both variant and no padding are set', () => {
    const { container } = render(
      <Card variant="highlighted">Highlighted</Card>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("border-indigo-400");
  });
});

// ── hoverable prop ─────────────────────────────────────────────────────────

describe("Card hoverable prop", () => {
  it('adds hover classes when hoverable is true', () => {
    const { container } = render(<Card hoverable>Hoverable</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("cursor-pointer");
    expect(el.className).toContain("hover:shadow-md");
  });

  it('does not add hover classes by default', () => {
    const { container } = render(<Card>Static</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).not.toContain("cursor-pointer");
  });
});

// ── Sub-components ─────────────────────────────────────────────────────────

describe("Card sub-components", () => {
  it('renders CardHeader, CardBody and CardFooter as children', () => {
    render(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardBody>Body</CardBody>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it('CardHeader has a bottom border separator class', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("border-b");
  });

  it('CardFooter has a top border separator class', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("border-t");
  });
});

// ── Custom className ───────────────────────────────────────────────────────

describe("Card className merging", () => {
  it('merges custom className with variant classes', () => {
    const { container } = render(
      <Card className="custom-class">Content</Card>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("custom-class");
    expect(el.className).toContain("border-gray-200");
  });
});
