"use client";

import React from "react";
import { Check, Copy, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { type Size, SIZE_DIMS } from "@/hooks/useEmbedCodeGenerator";

interface EmbedPreviewBlockProps {
  embedUrl: string;
  size: Size;
  iframeCode: string;
  copied: boolean;
  previewViewport: "desktop" | "mobile";
  onViewportChange: (vp: "desktop" | "mobile") => void;
  onCopy: () => void;
}

export function EmbedPreviewBlock({
  embedUrl,
  size,
  iframeCode,
  copied,
  previewViewport,
  onViewportChange,
  onCopy,
}: EmbedPreviewBlockProps) {
  const { width, height } = SIZE_DIMS[size];

  return (
    <div className="px-6 py-5 space-y-4">
      {/* Viewport toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Preview
        </span>
        <div
          role="group"
          aria-label="Preview viewport"
          className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800"
        >
          <button
            type="button"
            onClick={() => onViewportChange("desktop")}
            aria-pressed={previewViewport === "desktop"}
            aria-label="Desktop preview"
            className={`p-1.5 rounded-md transition ${
              previewViewport === "desktop"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            }`}
          >
            <Monitor size={13} />
          </button>
          <button
            type="button"
            onClick={() => onViewportChange("mobile")}
            aria-pressed={previewViewport === "mobile"}
            aria-label="Mobile preview"
            className={`p-1.5 rounded-md transition ${
              previewViewport === "mobile"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            }`}
          >
            <Smartphone size={13} />
          </button>
        </div>
      </div>

      {/* Live iframe preview */}
      <div
        className={`flex justify-center items-start overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 p-3 ${
          previewViewport === "mobile" ? "max-w-[200px] mx-auto" : ""
        }`}
      >
        <iframe
          key={embedUrl}
          src={embedUrl}
          width={previewViewport === "mobile" ? 180 : width}
          height={
            previewViewport === "mobile"
              ? Math.round(height * 0.75)
              : height
          }
          style={{
            border: "none",
            borderRadius: "12px",
            overflow: "hidden",
          }}
          title="Widget preview"
          loading="lazy"
        />
      </div>

      {/* Open in new tab */}
      <a
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-indigo-500 hover:underline"
      >
        <ExternalLink size={11} />
        Open widget in new tab
      </a>

      {/* Code block */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Embed Code
          </span>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
              bg-gray-100 dark:bg-gray-800
              text-gray-600 dark:text-gray-400
              hover:bg-gray-200 dark:hover:bg-gray-700
              transition"
            aria-label="Copy embed code"
          >
            {copied ? (
              <>
                <Check size={12} className="text-green-500" />
                <span className="text-green-600 dark:text-green-400">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
        </div>
        <pre
          className="text-[11px] leading-relaxed font-mono bg-gray-950 dark:bg-black text-gray-300 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all select-all"
          aria-label="Iframe embed code"
        >
          {iframeCode}
        </pre>
      </div>
    </div>
  );
}
