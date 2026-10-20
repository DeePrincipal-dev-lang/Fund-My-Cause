"use client";
/**
 * Component preview page: Select
 *
 * Rendered at /[locale]/components-preview/select
 *
 * Used exclusively by the Playwright visual regression suite (Issue #1172).
 */

import React, { useState } from "react";
import { Select } from "@fund-my-cause/components";

const SAMPLE_OPTIONS = [
  { value: "stellar", label: "Stellar (XLM)" },
  { value: "usdc", label: "USD Coin (USDC)" },
  { value: "aqua", label: "AQUA" },
  { value: "yxlm", label: "yXLM" },
] as const;

export default function SelectPreviewPage() {
  const [defaultVal, setDefaultVal] = useState("stellar");
  const [errorVal, setErrorVal] = useState("");

  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-12">
      <h1 className="text-2xl font-bold text-gray-900">Select — component preview</h1>

      {/* ── Default state ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Default — with label, selected value
        </h2>
        <div
          data-testid="select-default"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Select
            label="Token"
            options={SAMPLE_OPTIONS}
            value={defaultVal}
            onChange={(e) => setDefaultVal(e.target.value)}
          />
        </div>
      </section>

      {/* ── Placeholder ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          With placeholder
        </h2>
        <div
          data-testid="select-placeholder"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Select
            label="Choose a token"
            options={SAMPLE_OPTIONS}
            placeholder="Select a token…"
          />
        </div>
      </section>

      {/* ── Error state ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Error state
        </h2>
        <div
          data-testid="select-error"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Select
            label="Token"
            options={SAMPLE_OPTIONS}
            placeholder="Select a token…"
            value={errorVal}
            onChange={(e) => setErrorVal(e.target.value)}
            error="Please select a token to continue."
          />
        </div>
      </section>

      {/* ── Disabled state ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Disabled
        </h2>
        <div
          data-testid="select-disabled"
          className="max-w-xs p-6 bg-white rounded-lg border border-gray-200"
        >
          <Select
            label="Token (read-only)"
            options={SAMPLE_OPTIONS}
            value="stellar"
            disabled
            helperText="This field cannot be changed."
          />
        </div>
      </section>

      {/* ── Full-width ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Full-width
        </h2>
        <div
          data-testid="select-fullwidth"
          className="p-6 bg-white rounded-lg border border-gray-200"
        >
          <Select
            label="Token"
            options={SAMPLE_OPTIONS}
            placeholder="Select a token…"
            fullWidth
          />
        </div>
      </section>
    </div>
  );
}
