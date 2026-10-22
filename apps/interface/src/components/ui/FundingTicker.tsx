"use client";

/**
 * FundingTicker — real-time scrolling ticker of recent contributions.
 *
 * Accessibility:
 * - Respects prefers-reduced-motion (pauses animation, shows static list instead)
 * - Pause button (also pauses on hover/focus per WCAG 2.2 SC 2.2.2)
 * - role="marquee" with aria-label; items have aria-atomic
 * - Ticker region is aria-live="off" by default; screen readers get a
 *   separate visually-hidden live region that announces new items politely
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Pause, Play, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getCampaignSlug } from "@/lib/slugs";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TickerItem {
  id: string;
  contributorLabel: string; // e.g. "GA…XYZ" or "Anonymous"
  amountXlm: number;
  campaignTitle: string;
  campaignId: string;
  timestamp: number; // ms
}

interface Props {
  /** External items override internal mock data when provided */
  items?: TickerItem[];
  /** Polling interval in ms. 0 = no polling. Default 30 000 */
  pollInterval?: number;
  /** Called each poll cycle to fetch fresh items */
  onFetch?: () => Promise<TickerItem[]>;
  /** Scroll speed in px/s. Default 60 */
  speed?: number;
}

// ── Mock seed data (used when no real items provided) ─────────────────────

const MOCK_ITEMS: TickerItem[] = [
  {
    id: "m1",
    contributorLabel: "GA…3KFP",
    amountXlm: 250,
    campaignTitle: "Eco-Friendly Water Purification",
    campaignId: "1",
    timestamp: Date.now() - 30_000,
  },
  {
    id: "m2",
    contributorLabel: "GB…7LMQ",
    amountXlm: 500,
    campaignTitle: "Open Source AI Education Platform",
    campaignId: "2",
    timestamp: Date.now() - 60_000,
  },
  {
    id: "m3",
    contributorLabel: "GC…2NRX",
    amountXlm: 1000,
    campaignTitle: "Community Solar Microgrid",
    campaignId: "3",
    timestamp: Date.now() - 90_000,
  },
  {
    id: "m4",
    contributorLabel: "GD…9PVZ",
    amountXlm: 150,
    campaignTitle: "Decentralized Medical Records",
    campaignId: "4",
    timestamp: Date.now() - 120_000,
  },
  {
    id: "m5",
    contributorLabel: "GE…4WSD",
    amountXlm: 750,
    campaignTitle: "Eco-Friendly Water Purification",
    campaignId: "1",
    timestamp: Date.now() - 150_000,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatXlm(amount: number): string {
  return amount >= 1000
    ? `${(amount / 1000).toFixed(1)}K XLM`
    : `${amount.toLocaleString()} XLM`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FundingTicker({
  items: externalItems,
  pollInterval = 30_000,
  onFetch,
  speed = 60,
}: Props) {
  const [items, setItems] = useState<TickerItem[]>(externalItems ?? MOCK_ITEMS);
  const [paused, setPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Sync external items
  useEffect(() => {
    if (externalItems) setItems(externalItems);
  }, [externalItems]);

  // Polling
  const fetchItems = useCallback(async () => {
    if (!onFetch) return;
    try {
      const fresh = await onFetch();
      setItems(fresh);
    } catch {
      // silently ignore
    }
  }, [onFetch]);

  useEffect(() => {
    if (!onFetch || pollInterval <= 0) return;
    fetchItems();
    const id = setInterval(fetchItems, pollInterval);
    return () => clearInterval(id);
  }, [fetchItems, onFetch, pollInterval]);

  // Announce new items to screen readers via a visually-hidden live region
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    if (items.length === 0) return;
    const latest = items[0];
    setAnnounced(
      `New contribution: ${latest.contributorLabel} pledged ${formatXlm(latest.amountXlm)} to ${latest.campaignTitle}`,
    );
    const t = setTimeout(() => setAnnounced(""), 5000);
    return () => clearTimeout(t);
  }, [items]);

  // Animation duration based on item count and speed
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const observer = new ResizeObserver(() => {
      setTrackWidth(trackRef.current?.scrollWidth ?? 0);
    });
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [items]);

  const durationSec = trackWidth > 0 ? trackWidth / speed : 20;
  const isAnimating = !prefersReduced && !paused;

  if (items.length === 0) return null;

  // Reduced-motion: render a static, accessible list instead of the marquee
  if (prefersReduced) {
    return (
      <section
        aria-label="Recent contributions"
        className="border-y border-gray-800 bg-gray-900/60 py-3 px-6"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-400 shrink-0">
            <TrendingUp size={13} aria-hidden /> Live
          </span>
          <ul className="flex flex-wrap gap-x-6 gap-y-1" aria-label="Recent contributions list">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="text-xs text-gray-300">
                <span className="font-mono text-gray-500">{item.contributorLabel}</span>
                {" pledged "}
                <span className="font-semibold text-indigo-400">{formatXlm(item.amountXlm)}</span>
                {" → "}
                <Link
                  href={`/campaigns/${getCampaignSlug(item.campaignId)}`}
                  className="text-gray-200 hover:text-indigo-300 underline transition"
                >
                  {item.campaignTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // Duplicate items to create seamless loop
  const loopItems = [...items, ...items];

  return (
    <section
      aria-label="Live funding ticker"
      className="border-y border-gray-800 bg-gray-900/60 py-2.5 overflow-hidden relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Screen-reader live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announced}
      </div>

      <div className="flex items-center gap-0 max-w-full">
        {/* Left label + pause button */}
        <div className="shrink-0 flex items-center gap-2 pl-4 pr-3 border-r border-gray-700 bg-gray-900/80 z-10">
          <TrendingUp size={13} className="text-indigo-400" aria-hidden />
          <span className="text-xs font-semibold text-indigo-400 whitespace-nowrap">
            Live
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume ticker" : "Pause ticker"}
            aria-pressed={paused}
            className="p-1 rounded text-gray-500 hover:text-gray-300 transition"
          >
            {paused ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
          </button>
        </div>

        {/* Scrolling track */}
        <div
          role="marquee"
          aria-label="Recent contributions ticker"
          className="flex-1 overflow-hidden"
        >
          <div
            ref={trackRef}
            className="flex items-center gap-0 whitespace-nowrap"
            style={{
              animation: isAnimating
                ? `ticker-scroll ${durationSec}s linear infinite`
                : "none",
            }}
          >
            {loopItems.map((item, idx) => (
              <span
                key={`${item.id}-${idx}`}
                className="inline-flex items-center gap-1.5 px-5 text-xs text-gray-300"
                aria-atomic="true"
              >
                <span className="font-mono text-gray-500 shrink-0">
                  {item.contributorLabel}
                </span>
                <span className="text-gray-600" aria-hidden>pledged</span>
                <span className="font-semibold text-indigo-400">
                  {formatXlm(item.amountXlm)}
                </span>
                <span className="text-gray-600" aria-hidden>→</span>
                <Link
                  href={`/campaigns/${getCampaignSlug(item.campaignId)}`}
                  className="text-gray-200 hover:text-indigo-300 transition underline-offset-2 hover:underline"
                  tabIndex={paused ? 0 : -1}
                  aria-hidden={!paused}
                >
                  {item.campaignTitle}
                </Link>
                <span className="text-gray-700 text-[10px] tabular-nums ml-1">
                  {timeAgo(item.timestamp)}
                </span>
                <span className="text-gray-700 mx-2 select-none" aria-hidden>·</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
