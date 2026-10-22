import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV === "development";

// CDN origin for image delivery (optional — leave unset to serve from origin)
const IMAGE_CDN_URL = process.env.NEXT_PUBLIC_IMAGE_CDN_URL ?? "";

/**
 * Content Security Policy for standard app routes.
 *
 * default-src 'self'          — baseline: only same-origin resources allowed
 * script-src  'self' + eval + inline (dev only) — 'unsafe-eval' and
 *   'unsafe-inline' are required by Turbopack's dev-mode HMR bootstrap
 *   inline scripts; without 'unsafe-inline' the CSP blocks hydration
 *   entirely (self.__next_r never gets set → hydration invariant crash)
 * style-src   'self' 'unsafe-inline' — Tailwind injects inline styles
 * connect-src 'self' + RPC   — Soroban RPC, Horizon, CoinGecko price feed
 * img-src     'self' data:   — data URIs; Unsplash & IPFS for campaign images
 * font-src    'self'          — self-hosted fonts only
 * frame-ancestors 'none'     — prevents clickjacking
 * object-src  'none'          — disables Flash / legacy plugin embeds
 */
const cspDefault = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  [
    "connect-src 'self'",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://api.coingecko.com",
  ].join(" "),
  [
    "img-src 'self' data:",
    "https://images.unsplash.com",
    "https://ipfs.io",
    IMAGE_CDN_URL || null,
  ]
    .filter(Boolean)
    .join(" "),
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

/**
 * Relaxed CSP for the /embed/* route.
 * frame-ancestors is set to '*' so any external site can embed the widget.
 * X-Frame-Options is intentionally omitted for this route (set to ALLOWALL).
 */
const cspEmbed = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  [
    "connect-src 'self'",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://api.coingecko.com",
  ].join(" "),
  [
    "img-src 'self' data:",
    "https://images.unsplash.com",
    "https://ipfs.io",
    IMAGE_CDN_URL || null,
  ]
    .filter(Boolean)
    .join(" "),
  "font-src 'self'",
  "frame-ancestors *",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",

  // Workspace packages are published from TypeScript source (no dist), so Next
  // has to compile them alongside the app.
  transpilePackages: [
    "@fund-my-cause/components",
    "@fund-my-cause/shared-utils",
    "@fund-my-cause/types",
  ],

  images: {
    // Serve AVIF first (best compression), fall back to WebP, then original.
    formats: ["image/avif", "image/webp"],
    // Breakpoints used to generate responsive srcset variants.
    // Aligned with RESPONSIVE_WIDTHS in imageOptimization.ts.
    deviceSizes: [320, 480, 640, 750, 1080, 1200, 1920],
    // Sizes for fixed-layout images (e.g. thumbnails, avatars).
    imageSizes: [16, 32, 48, 56, 64, 96, 128, 256],
    // Minimum cache TTL for optimised images — 30 days at the edge.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      // Allow the configured CDN origin so next/image can serve through it.
      ...(IMAGE_CDN_URL
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(IMAGE_CDN_URL).hostname,
            },
          ]
        : []),
    ],
  },

  async headers() {
    return [
      // ── Service worker — must not be cached ─────────────────────────────────
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      // ── Embed widget route — allow framing from any origin ──────────────────
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspEmbed },
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), push=(self), notifications=(self)",
          },
        ],
      },
      // ── Campaign pages — cacheable, invalidate on campaign update ───────────
      {
        source: "/campaigns/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspDefault },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), push=(self), notifications=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
          },
          { key: "Surrogate-Key", value: "campaigns" },
          { key: "ETag", value: `"${Date.now()}"` },
        ],
      },
      // ── API-like read responses — cache at edge for 2 minutes ──────────────
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Cache-Control",
            value:
              "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
          },
          { key: "Surrogate-Key", value: "api" },
        ],
      },
      // ── Static assets (images, fonts, etc.) — long-lived cache ──────────────
      {
        source:
          "/:all*(svg|png|jpg|jpeg|gif|ico|webp|avif|woff2?|ttf|eot|css|js)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Surrogate-Key", value: "assets" },
        ],
      },
      // ── All other routes — strict security headers, no CDN cache ────────────
      {
        source: "/((?!embed|campaigns|api).*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDefault },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), push=(self), notifications=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
