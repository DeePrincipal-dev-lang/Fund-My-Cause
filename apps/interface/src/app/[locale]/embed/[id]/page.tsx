import { notFound } from "next/navigation";
import { fetchCampaign } from "@/lib/graphql/client";
import { APP_BASE_URL } from "@/lib/constants";
import { EmbedCard } from "@/components/ui/EmbedCard";
import type {
  EmbedTheme,
  EmbedSize,
  EmbedAccent,
} from "@/components/ui/EmbedCard";

// ── ISR ───────────────────────────────────────────────────────────────────────

export const revalidate = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    theme?: string;
    size?: string;
    accent?: string;
    hideImage?: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTheme(v?: string): EmbedTheme {
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "dark";
}

function parseSize(v?: string): EmbedSize {
  if (v === "compact" || v === "standard" || v === "wide") return v;
  return "standard";
}

function parseAccent(v?: string): EmbedAccent {
  // Allow any valid 6-char hex colour, e.g. "6366f1"
  if (v && /^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  return "#6366f1"; // indigo-500 default
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  let campaign;
  try {
    campaign = await fetchCampaign(id);
  } catch {
    notFound();
  }

  const theme = parseTheme(sp.theme);
  const size = parseSize(sp.size);
  const accent = parseAccent(sp.accent);
  const hideImage = sp.hideImage === "1";
  const campaignUrl = `${APP_BASE_URL}/campaigns/${id}`;

  return (
    <EmbedCard
      campaign={campaign}
      campaignUrl={campaignUrl}
      theme={theme}
      size={size}
      accent={accent}
      hideImage={hideImage}
    />
  );
}
