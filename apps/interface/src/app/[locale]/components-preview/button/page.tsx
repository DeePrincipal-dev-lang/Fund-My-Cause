"use client";
/**
 * Component preview page: Button
 *
 * Rendered at /[locale]/components-preview/button
 *
 * Used exclusively by the Playwright visual regression suite (Issue #1172).
 * Each section is wrapped in a stable data-testid so tests can target
 * precisely the region they want to screenshot.
 *
 * This page has no auth guard, no fetching, and no side effects — it is
 * a pure component showcase so screenshots are stable and reproducible.
 */

import React from "react";
import { Button } from "@fund-my-cause/components";

export default function ButtonPreviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-12">
      <h1 className="text-2xl font-bold text-gray-900">Button — component preview</h1>

      {/* ── All variants ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Variants
        </h2>
        <div
          data-testid="button-variants"
          className="flex flex-wrap gap-3 p-6 bg-white rounded-lg border border-gray-200"
        >
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </section>

      {/* ── Size variants ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Sizes
        </h2>
        <div
          data-testid="button-sizes"
          className="flex flex-wrap items-center gap-3 p-6 bg-white rounded-lg border border-gray-200"
        >
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      {/* ── Loading state ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Loading state
        </h2>
        <div
          data-testid="button-loading"
          className="flex flex-wrap gap-3 p-6 bg-white rounded-lg border border-gray-200"
        >
          <Button variant="primary" isLoading>
            Loading…
          </Button>
          <Button variant="secondary" isLoading>
            Loading…
          </Button>
        </div>
      </section>

      {/* ── Disabled state ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Disabled state
        </h2>
        <div
          data-testid="button-disabled"
          className="flex flex-wrap gap-3 p-6 bg-white rounded-lg border border-gray-200"
        >
          <Button variant="primary" disabled>
            Disabled primary
          </Button>
          <Button variant="secondary" disabled>
            Disabled secondary
          </Button>
          <Button variant="outline" disabled>
            Disabled outline
          </Button>
          <Button variant="danger" disabled>
            Disabled danger
          </Button>
        </div>
      </section>

      {/* ── Full-width ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Full-width
        </h2>
        <div
          data-testid="button-fullwidth"
          className="p-6 bg-white rounded-lg border border-gray-200 max-w-sm"
        >
          <Button variant="primary" fullWidth>
            Full-width primary
          </Button>
        </div>
      </section>
    </div>
  );
}
