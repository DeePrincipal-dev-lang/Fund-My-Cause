"use client";
/**
 * Component preview page: Card
 *
 * Rendered at /[locale]/components-preview/card
 *
 * Used exclusively by the Playwright visual regression suite (Issue #1172).
 */

import React from "react";
import { Card, CardHeader, CardBody, CardFooter } from "@fund-my-cause/components";

export default function CardPreviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-12">
      <h1 className="text-2xl font-bold text-gray-900">Card — component preview</h1>

      {/* ── Default variant ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Default variant
        </h2>
        <div
          data-testid="card-default"
          className="max-w-sm"
        >
          <Card variant="default">
            <p className="text-gray-700">
              This is the default card with standard padding and a subtle border.
            </p>
          </Card>
        </div>
      </section>

      {/* ── Compact variant ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Compact variant
        </h2>
        <div
          data-testid="card-compact"
          className="max-w-sm"
        >
          <Card variant="compact">
            <p className="text-gray-700 text-sm">
              Compact card with reduced padding for dense layouts.
            </p>
          </Card>
        </div>
      </section>

      {/* ── Highlighted variant ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Highlighted variant
        </h2>
        <div
          data-testid="card-highlighted"
          className="max-w-sm"
        >
          <Card variant="highlighted">
            <p className="text-gray-700">
              Highlighted card with accented border and tinted background.
            </p>
          </Card>
        </div>
      </section>

      {/* ── Hoverable ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Hoverable
        </h2>
        <div
          data-testid="card-hoverable"
          className="max-w-sm"
        >
          <Card variant="default" hoverable>
            <p className="text-gray-700">
              Hover over me to see the hover state.
            </p>
          </Card>
        </div>
      </section>

      {/* ── With CardHeader, CardBody, CardFooter ──────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          With header, body, and footer sections
        </h2>
        <div
          data-testid="card-with-sections"
          className="max-w-sm"
        >
          <Card variant="default">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Card Header</h3>
            </CardHeader>
            <CardBody>
              <p className="text-gray-700">
                Card body content goes here. This section uses the CardBody
                wrapper for consistent internal spacing.
              </p>
            </CardBody>
            <CardFooter>
              <p className="text-sm text-gray-500">Card footer with metadata</p>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  );
}
