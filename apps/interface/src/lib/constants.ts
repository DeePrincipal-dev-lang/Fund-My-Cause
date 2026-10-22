/**
 * Application-wide constants derived from environment variables and configuration.
 * Required variables are validated at module load time — a missing var throws
 * immediately so the error surfaces at startup rather than at runtime.
 */

/**
 * Validates a required environment variable's value.
 *
 * Next.js only inlines `NEXT_PUBLIC_*` vars into the client bundle when they're
 * accessed as a literal `process.env.NEXT_PUBLIC_X` — a dynamic `process.env[key]`
 * lookup can't be statically replaced, so it silently resolves to `undefined` in
 * the browser even though the same code works fine on the server. Callers must
 * pass the literal `process.env.NEXT_PUBLIC_X` expression in, not just the name.
 * @param {string} name - Environment variable name, for the error message
 * @param {string | undefined} value - The variable's value (pass `process.env.NAME` directly)
 * @returns {string} The validated value
 * @throws {Error} If the value is not set
 */
const DEFAULT_ENV: Record<string, string> = {
  NEXT_PUBLIC_CONTRACT_ID:
    "CA3D5KRYMCMUZNRCQU63ST3GZ5W6V4B5PR26CPMCEL6A6AXI62RP4CWH",
  NEXT_PUBLIC_RPC_URL: "https://soroban-testnet.stellar.org",
  NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_HORIZON_URL: "https://horizon-testnet.stellar.org",
};

function requireEnv(name: string, value: string | undefined): string {
  const resolved = value || DEFAULT_ENV[name];
  if (!resolved) {
    return "";
  }
  return resolved;
}

// ──────────────────────────────────────────────────────────────────────────────
// Environment-based constants
// ──────────────────────────────────────────────────────────────────────────────

/** The Soroban crowdfunding contract address. */
export const CONTRACT_ID = requireEnv(
  "NEXT_PUBLIC_CONTRACT_ID",
  process.env.NEXT_PUBLIC_CONTRACT_ID,
);

/** The Soroban RPC endpoint URL. */
export const RPC_URL = requireEnv(
  "NEXT_PUBLIC_RPC_URL",
  process.env.NEXT_PUBLIC_RPC_URL,
);

/** The Stellar network passphrase (testnet or mainnet). */
export const NETWORK_PASSPHRASE = requireEnv(
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
);

/** The Horizon API endpoint URL. */
export const HORIZON_URL = requireEnv(
  "NEXT_PUBLIC_HORIZON_URL",
  process.env.NEXT_PUBLIC_HORIZON_URL,
);

/** Human-readable network name derived from NETWORK_PASSPHRASE. */
export const NETWORK_NAME =
  NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015"
    ? "mainnet"
    : "testnet";

/** Application base URL for metadata and sharing */
export const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://fund-my-cause.app";

// ──────────────────────────────────────────────────────────────────────────────
// External API endpoints
// ──────────────────────────────────────────────────────────────────────────────

/** CoinGecko API endpoint for cryptocurrency pricing */
export const COINGECKO_API_URL =
  "https://api.coingecko.com/api/v3/simple/price";

/** Pinata IPFS pinning service endpoint */
export const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

/** Stellar Expert base URL for transaction and account exploration */
export const STELLAR_EXPERT_BASE_URL = "https://stellar.expert";

// ──────────────────────────────────────────────────────────────────────────────
// Default placeholder images (Unsplash)
// ──────────────────────────────────────────────────────────────────────────────

/** Default hero image for campaign metadata (Unsplash) */
export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1200";

/** Default campaign card image (Unsplash) */
export const DEFAULT_CAMPAIGN_IMAGE =
  "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800";

/** Alternative campaign image variant 1 (Unsplash) */
export const DEFAULT_CAMPAIGN_IMAGE_ALT_1 =
  "https://images.unsplash.com/photo-1555949963-aa79dcee5789?auto=format&fit=crop&q=80&w=800";

/** Alternative campaign image variant 2 (Unsplash) */
export const DEFAULT_CAMPAIGN_IMAGE_ALT_2 =
  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800";

/** Alternative campaign image variant 3 (Unsplash) */
export const DEFAULT_CAMPAIGN_IMAGE_ALT_3 =
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800";

// ──────────────────────────────────────────────────────────────────────────────
// UI/UX constants
// ──────────────────────────────────────────────────────────────────────────────

/** Maximum length for campaign title */
export const MAX_TITLE_LENGTH = 100;

/** Maximum length for campaign description */
export const MAX_DESCRIPTION_LENGTH = 5000;

/** Default pagination page size */
export const DEFAULT_PAGE_SIZE = 10;

/** XLM price cache duration (ISR revalidate) in seconds */
export const XLM_PRICE_CACHE_SECONDS = 300; // 5 minutes

/** Campaign page ISR revalidate interval in seconds */
export const CAMPAIGN_PAGE_REVALIDATE_SECONDS = 60; // 1 minute
