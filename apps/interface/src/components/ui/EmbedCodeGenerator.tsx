"use client";

import React from "react";
import { Code2 } from "lucide-react";
import { useEmbedCodeGenerator } from "@/hooks/useEmbedCodeGenerator";
import { EmbedOptionsForm } from "./embed/EmbedOptionsForm";
import { EmbedPreviewBlock } from "./embed/EmbedPreviewBlock";

interface EmbedCodeGeneratorProps {
  campaignId: string;
  campaignTitle: string;
}

export function EmbedCodeGenerator({
  campaignId,
  campaignTitle,
}: EmbedCodeGeneratorProps) {
  const {
    open,
    setOpen,
    theme,
    setTheme,
    size,
    setSize,
    accent,
    customAccent,
    hideImage,
    setHideImage,
    copied,
    previewViewport,
    setPreviewViewport,
    embedUrl,
    iframeCode,
    handleCopy,
    handleAccentPreset,
    handleCustomAccent,
  } = useEmbedCodeGenerator({ campaignId, campaignTitle });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
          bg-gray-100 dark:bg-gray-800
          text-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-gray-700
          transition"
        aria-label="Get embed code for this campaign"
      >
        <Code2 size={15} />
        Embed Widget
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="embed-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-indigo-500" aria-hidden="true" />
            <h2
              id="embed-modal-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Embed Widget
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close embed widget dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
          <EmbedOptionsForm
            theme={theme}
            onThemeChange={setTheme}
            size={size}
            onSizeChange={setSize}
            accent={accent}
            customAccent={customAccent}
            onAccentPreset={handleAccentPreset}
            onCustomAccent={handleCustomAccent}
            hideImage={hideImage}
            onHideImageChange={setHideImage}
          />

          <EmbedPreviewBlock
            embedUrl={embedUrl}
            size={size}
            iframeCode={iframeCode}
            copied={copied}
            previewViewport={previewViewport}
            onViewportChange={setPreviewViewport}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </div>
  );
}
