"use client";
/**
 * Component preview page: Input
 *
 * Rendered at /[locale]/components-preview/input
 *
 * Used exclusively by the Playwright visual regression suite (Issue #1172).
 */

import React, { useState } from "react";
import { Input } from "@fund-my-cause/components";

export default function InputPreviewPage() {
  const [value, setValue] = useState("");

  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-12">
      <h1 className="text-2xl font-bold text-gray-900">Input — component preview</h1>

      {/* ── Default state ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Default state
        </h2>
        <div
          data-testid="input-default"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Input
            type="text"
            placeholder="Enter campaign name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </section>

      {/* ── With label and helper text ─────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          With label and helper text
        </h2>
        <div
          data-testid="input-with-label"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Input
            label="Campaign title"
            type="text"
            placeholder="e.g. Clean water for rural Uganda"
            helperText="Between 5 and 120 characters."
          />
        </div>
      </section>

      {/* ── Error state ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Error state
        </h2>
        <div
          data-testid="input-error"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Input
            label="Funding goal (XLM)"
            type="number"
            defaultValue="0"
            error="Funding goal must be greater than 0."
          />
        </div>
      </section>

      {/* ── Disabled state ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Disabled state
        </h2>
        <div
          data-testid="input-disabled"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Input
            label="Contract address"
            type="text"
            defaultValue="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
            disabled
            helperText="Set at campaign creation and cannot be changed."
          />
        </div>
      </section>

      {/* ── Required indicator ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Required field
        </h2>
        <div
          data-testid="input-required"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Input
            label="Wallet address"
            type="text"
            placeholder="G…"
            required
            helperText="Your Stellar public key."
          />
        </div>
      </section>
    </div>
  );
}
