"use client";

import { useState, useMemo } from "react";
import { APP_BASE_URL } from "@/lib/constants";

export type Theme = "dark" | "light" | "auto";
export type Size = "compact" | "standard" | "wide";

export const SIZE_DIMS: Record<
  Size,
  { width: number; height: number; label: string }
> = {
  compact: { width: 320, height: 200, label: "Compact  320 × 200" },
  standard: { width: 380, height: 320, label: "Standard  380 × 320" },
  wide: { width: 480, height: 400, label: "Wide  480 × 400" },
};

export const ACCENT_PRESETS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Sky", value: "#0ea5e9" },
];

function hexToParam(hex: string): string {
  return hex.replace("#", "");
}

function buildEmbedUrl(
  campaignId: string,
  theme: Theme,
  size: Size,
  accent: string,
  hideImage: boolean,
): string {
  const params = new URLSearchParams({
    theme,
    size,
    accent: hexToParam(accent),
    ...(hideImage ? { hideImage: "1" } : {}),
  });
  return `${APP_BASE_URL}/embed/${campaignId}?${params.toString()}`;
}

function buildIframeCode(
  embedUrl: string,
  size: Size,
  campaignTitle: string,
): string {
  const { width, height } = SIZE_DIMS[size];
  return `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  style="border:none;border-radius:16px;overflow:hidden;"
  title="${campaignTitle} — Fund-My-Cause"
  loading="lazy"
  allow="payment"
></iframe>`;
}

interface UseEmbedCodeGeneratorOptions {
  campaignId: string;
  campaignTitle: string;
}

export function useEmbedCodeGenerator({
  campaignId,
  campaignTitle,
}: UseEmbedCodeGeneratorOptions) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [size, setSize] = useState<Size>("standard");
  const [accent, setAccent] = useState("#6366f1");
  const [customAccent, setCustomAccent] = useState("#6366f1");
  const [hideImage, setHideImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "desktop",
  );

  const embedUrl = useMemo(
    () => buildEmbedUrl(campaignId, theme, size, accent, hideImage),
    [campaignId, theme, size, accent, hideImage],
  );

  const iframeCode = useMemo(
    () => buildIframeCode(embedUrl, size, campaignTitle),
    [embedUrl, size, campaignTitle],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback copy
    }
  };

  const handleAccentPreset = (hex: string) => {
    setAccent(hex);
    setCustomAccent(hex);
  };

  const handleCustomAccent = (hex: string) => {
    setCustomAccent(hex);
    setAccent(hex);
  };

  return {
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
  };
}
