"use client";

import React from "react";
import {
  type Theme,
  type Size,
  SIZE_DIMS,
  ACCENT_PRESETS,
} from "@/hooks/useEmbedCodeGenerator";

interface EmbedOptionsFormProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  size: Size;
  onSizeChange: (s: Size) => void;
  accent: string;
  customAccent: string;
  onAccentPreset: (hex: string) => void;
  onCustomAccent: (hex: string) => void;
  hideImage: boolean;
  onHideImageChange: (hide: boolean) => void;
}

export function EmbedOptionsForm({
  theme,
  onThemeChange,
  size,
  onSizeChange,
  accent,
  customAccent,
  onAccentPreset,
  onCustomAccent,
  hideImage,
  onHideImageChange,
}: EmbedOptionsFormProps) {
  return (
    <div className="px-6 py-5 space-y-5">
      {/* Theme */}
      <fieldset>
        <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Theme
        </legend>
        <div className="flex gap-2">
          {(["dark", "light", "auto"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onThemeChange(t)}
              aria-pressed={theme === t}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition border ${
                theme === t
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Size */}
      <fieldset>
        <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Size
        </legend>
        <div className="space-y-1.5">
          {(
            Object.entries(SIZE_DIMS) as [Size, (typeof SIZE_DIMS)[Size]][]
          ).map(([s, cfg]) => (
            <label
              key={s}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition ${
                size === s
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <input
                type="radio"
                name="embed-size"
                value={s}
                checked={size === s}
                onChange={() => onSizeChange(s)}
                className="accent-indigo-600"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 capitalize font-medium">
                {s}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {cfg.width} × {cfg.height}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Accent colour */}
      <fieldset>
        <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Accent Colour
        </legend>
        <div className="flex flex-wrap gap-2 mb-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onAccentPreset(p.value)}
              aria-label={`${p.label} accent`}
              aria-pressed={accent === p.value}
              className={`w-7 h-7 rounded-full border-2 transition ${
                accent === p.value
                  ? "border-white scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: p.value }}
            />
          ))}
          <label
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-gray-600 dark:hover:border-gray-400 transition overflow-hidden"
            aria-label="Custom accent colour"
            title="Custom colour"
          >
            <input
              type="color"
              value={customAccent}
              onChange={(e) => onCustomAccent(e.target.value)}
              className="opacity-0 absolute w-0 h-0"
            />
            <span className="text-[10px] text-gray-400">+</span>
          </label>
        </div>
        <p className="text-xs text-gray-400 font-mono">{accent}</p>
      </fieldset>

      {/* Hide image toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={hideImage}
          onChange={(e) => onHideImageChange(e.target.checked)}
          className="w-4 h-4 rounded accent-indigo-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Hide hero image
        </span>
      </label>
    </div>
  );
}
