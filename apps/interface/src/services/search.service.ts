/**
 * Advanced search service — pure TypeScript, no React or UI dependencies.
 *
 * Implements TF-IDF-inspired relevance scoring, fuzzy matching via edit distance,
 * semantic keyword expansion, multi-field weighted ranking, and personalized
 * result boosting based on stored user category preferences.
 */

import type { Campaign } from "@/types/campaign";

// ── Scoring weights (configuration) ───────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * All numeric factors used by {@link scoreCampaign} in search.service.ts.
 *
 * Names follow the pattern: <field>_<matchKind>.
 *
 * - `exactPhrase` variants apply when the raw query string appears verbatim.
 * - `token` variants apply for individual query tokens.
 * - `fuzzy` variants apply when edit-distance matches (not exact token hits).
 * - `semantic` variants apply for semantically-expanded tokens only.
 * - `categoryBoostMax` caps the personalisation multiplier.
 * - `categoryBoostRate` controls how steeply each extra category view lifts
 *   the multiplier (multiplier = min(categoryBoostMax, 1 + views * rate)).
 */
export interface ScoringWeights {
  /** Exact phrase match in title */
  titleExactPhrase: number;
  /** Per-token match in title */
  titleToken: number;
  /** Fuzzy (edit-distance) match in title */
  titleFuzzy: number;
  /** Exact phrase match in description */
  descriptionExactPhrase: number;
  /** Per-token match in description */
  descriptionToken: number;
  /** Fuzzy match in description */
  descriptionFuzzy: number;
  /** Token or exact match in category */
  categoryToken: number;
  /** Semantic-expansion match in category */
  categorySemantic: number;
  /** Token match in creator field */
  creatorToken: number;
  /** Semantic-only token matching title */
  semanticTitle: number;
  /** Semantic-only token matching description */
  semanticDescription: number;
  /** Maximum personalisation boost multiplier */
  categoryBoostMax: number;
  /** Per-view increment for personalisation boost */
  categoryBoostRate: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Out-of-the-box weights that reproduce the original hard-coded behaviour.
 * These are used verbatim when no environment overrides are present.
 */
export const DEFAULT_SCORING_WEIGHTS: Readonly<ScoringWeights> = Object.freeze({
  titleExactPhrase: 10,
  titleToken: 5,
  titleFuzzy: 2.5,
  descriptionExactPhrase: 4,
  descriptionToken: 2,
  descriptionFuzzy: 1,
  categoryToken: 4,
  categorySemantic: 1.5,
  creatorToken: 1,
  semanticTitle: 2,
  semanticDescription: 0.5,
  categoryBoostMax: 1.5,
  categoryBoostRate: 0.1,
});

/** All field names that must be present in a fully-resolved config. */
const REQUIRED_KEYS = Object.keys(
  DEFAULT_SCORING_WEIGHTS,
) as (keyof ScoringWeights)[];

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validates `weights` and throws a descriptive {@link Error} if any value is
 * missing or falls outside the allowed range.
 *
 * Allowed range:
 *  - every weight must be a finite, non-negative number
 *  - `categoryBoostMax` must be ≥ 1 (a boost below 1× would demote results)
 *  - `categoryBoostRate` must be ≤ 1 (per-view increment > 1 causes runaway
 *    multipliers)
 */
export function validateScoringWeights(weights: Partial<ScoringWeights>): void {
  for (const key of REQUIRED_KEYS) {
    const val = weights[key];
    if (val === undefined || val === null) {
      throw new Error(
        `[search-weights] Missing required weight: "${key}". ` +
          `Set NEXT_PUBLIC_SEARCH_WEIGHT_${key.toUpperCase()} or rely on the built-in default.`,
      );
    }
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(
        `[search-weights] Weight "${key}" must be a finite number, got: ${JSON.stringify(val)}`,
      );
    }
    if (val < 0) {
      throw new Error(
        `[search-weights] Weight "${key}" must be ≥ 0, got: ${val}`,
      );
    }
  }

  const boostMax = weights.categoryBoostMax as number;
  if (boostMax < 1) {
    throw new Error(
      `[search-weights] "categoryBoostMax" must be ≥ 1 (a value < 1 demotes personalised results), got: ${boostMax}`,
    );
  }

  const boostRate = weights.categoryBoostRate as number;
  if (boostRate > 1) {
    throw new Error(
      `[search-weights] "categoryBoostRate" must be ≤ 1 to prevent runaway multipliers, got: ${boostRate}`,
    );
  }
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Builds a {@link ScoringWeights} object from an optional environment-variable
 * map (defaults to `process.env`).
 *
 * For every weight key the function looks for the corresponding env var:
 *   `NEXT_PUBLIC_SEARCH_WEIGHT_<KEY_UPPER_SNAKE>`
 *
 * If the var is absent the default value is used silently.  If it is present
 * but not a valid finite number an error is thrown immediately.
 *
 * After merging defaults with overrides the full object is validated and
 * returned frozen.
 *
 * @param env - Map of environment variables (injectable for testing).
 */
export function loadScoringWeights(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): Readonly<ScoringWeights> {
  const resolved: Record<string, number> = {};

  for (const key of REQUIRED_KEYS) {
    const envKey = "NEXT_PUBLIC_SEARCH_WEIGHT_" + camelToUpperSnake(key);
    const rawValue = env[envKey];

    if (rawValue === undefined || rawValue === "") {
      // Fall back to built-in default — partial config is valid
      resolved[key] = DEFAULT_SCORING_WEIGHTS[key];
    } else {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(
          `[search-weights] Environment variable ${envKey} must be a finite number, got: "${rawValue}"`,
        );
      }
      resolved[key] = parsed;
    }
  }

  const weights = resolved as unknown as ScoringWeights;
  // Run the full semantic validator after merging with defaults
  validateScoringWeights(weights);
  return Object.freeze(weights);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a camelCase key (e.g. "titleExactPhrase") to UPPER_SNAKE_CASE
 * (e.g. "TITLE_EXACT_PHRASE") for environment variable lookup.
 */
function camelToUpperSnake(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

// ── Module-level singleton ─────────────────────────────────────────────────────

/**
 * The application-wide scoring weights, resolved once at module load time.
 *
 * Import this constant wherever you need weights rather than calling
 * `loadScoringWeights()` every time.
 */
export const SCORING_WEIGHTS: Readonly<ScoringWeights> = loadScoringWeights();

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilterStatus = "all" | "active" | "funded" | "ended";
export type SortOption =
  | "relevance"
  | "newest"
  | "recent" // alias for "newest" — kept for URL backward compatibility
  | "most-funded"
  | "ending-soon"
  | "trending";

export interface SearchFilters {
  query?: string;
  category?: string;
  status?: FilterStatus;
  goalMin?: number;
  goalMax?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface ScoredCampaign {
  campaign: Campaign;
  score: number;
  matchedFields: Array<"title" | "description" | "category" | "creator">;
  highlights: { title?: string; description?: string };
}

export interface SearchFacets {
  categories: Array<{ slug: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
  goalRange: { min: number; max: number };
}

export interface SearchResult {
  items: ScoredCampaign[];
  total: number;
  totalPages: number;
  facets: SearchFacets;
  durationMs: number;
  didYouMean?: string;
}

export interface UserPreferences {
  categoryViews: Record<string, number>;
  recentSearches: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PREFS_KEY = "fmc:user-prefs";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "be",
  "been",
  "have",
  "has",
  "do",
  "does",
  "will",
  "can",
  "this",
  "that",
  "it",
  "we",
  "they",
  "our",
  "their",
  "your",
  "its",
]);

// Curated semantic expansion map — maps common search terms to related concepts
// so that e.g. searching "eco" also surfaces "environment" category campaigns.
const SEMANTIC_MAP: Record<string, string[]> = {
  eco: ["environment", "green", "sustainable", "climate", "nature"],
  green: ["eco", "environment", "sustainable", "solar", "clean"],
  environment: ["eco", "green", "sustainable", "climate", "earth", "planet"],
  sustainable: ["eco", "green", "environment", "solar", "renewable"],
  solar: ["energy", "renewable", "clean", "power", "microgrid", "sustainable"],
  renewable: ["solar", "energy", "clean", "sustainable", "green"],
  water: ["purification", "clean", "drinking", "filtration", "aqua", "ocean"],
  purification: ["water", "clean", "filtration", "eco", "solar", "drinking"],
  ocean: ["sea", "marine", "plastic", "water", "coastal", "drone", "cleanup"],
  plastic: ["ocean", "cleanup", "recycling", "drone", "environment", "waste"],
  climate: ["environment", "carbon", "green", "sustainable", "warming"],
  technology: ["tech", "digital", "software", "innovation", "internet", "ai"],
  tech: ["technology", "digital", "software", "innovation", "internet"],
  ai: ["artificial", "intelligence", "machine", "learning", "digital", "tech"],
  artificial: ["ai", "intelligence", "machine", "learning"],
  intelligence: ["ai", "artificial", "machine", "learning", "tech"],
  blockchain: ["decentralized", "crypto", "stellar", "distributed", "records"],
  decentralized: ["blockchain", "distributed", "stellar", "crypto", "records"],
  internet: [
    "connectivity",
    "network",
    "digital",
    "online",
    "broadband",
    "mesh",
  ],
  connectivity: [
    "internet",
    "network",
    "digital",
    "broadband",
    "mesh",
    "rural",
  ],
  mesh: ["connectivity", "network", "internet", "rural"],
  education: ["learn", "teach", "school", "course", "training", "knowledge"],
  learn: ["education", "teach", "course", "training", "study", "open"],
  open: ["free", "accessible", "public", "source", "learn"],
  health: ["medical", "hospital", "wellness", "care", "medicine", "patient"],
  medical: [
    "health",
    "healthcare",
    "hospital",
    "doctor",
    "medicine",
    "records",
  ],
  records: ["medical", "data", "decentralized", "blockchain", "secure"],
  community: ["local", "social", "people", "rural", "village", "neighborhood"],
  rural: ["community", "remote", "countryside", "connectivity", "village"],
  drone: ["autonomous", "robot", "ocean", "plastic", "cleanup", "fleet"],
  fund: ["raise", "support", "donate", "contribute", "invest", "campaign"],
  clean: ["purification", "water", "eco", "solar", "renewable"],
  energy: [
    "solar",
    "power",
    "renewable",
    "electric",
    "sustainable",
    "microgrid",
  ],
  microgrid: ["solar", "energy", "community", "power", "renewable"],
};

// ── Tokenisation ──────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function expandQuery(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const related = SEMANTIC_MAP[token];
    if (related) related.forEach((r) => expanded.add(r));
  }
  return Array.from(expanded);
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

function editDistance(a: string, b: string): number {
  // Skip pairs too far apart to match the threshold
  if (Math.abs(a.length - b.length) > 3) return Infinity;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(row[j], row[j - 1], prev);
      prev = temp;
    }
  }
  return row[n];
}

function fuzzyMatch(queryToken: string, fieldText: string): boolean {
  if (queryToken.length <= 3) return false;
  const threshold = queryToken.length <= 5 ? 1 : 2;
  const fieldTokens = tokenize(fieldText);
  return fieldTokens.some((t) => editDistance(queryToken, t) <= threshold);
}

// ── Text highlighting ─────────────────────────────────────────────────────────

function highlight(text: string, match: string, maxLen = 120): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(match.toLowerCase());
  if (idx < 0) return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + match.length + 60);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end) +
    (end < text.length ? "…" : "")
  );
}

// ── Campaign status ───────────────────────────────────────────────────────────

export function getCampaignStatusValue(c: Campaign): FilterStatus {
  if (c.raised >= c.goal) return "funded";
  if (new Date(c.deadline) < new Date()) return "ended";
  return "active";
}

// ── Relevance scoring ─────────────────────────────────────────────────────────

function scoreCampaign(
  campaign: Campaign,
  queryTokens: string[],
  expandedTokens: string[],
  rawQuery: string,
  preferences: UserPreferences,
  weights: ScoringWeights = SCORING_WEIGHTS,
): Pick<ScoredCampaign, "score" | "matchedFields" | "highlights"> {
  if (!rawQuery.trim()) return { score: 1, matchedFields: [], highlights: {} };

  let score = 0;
  const matchedFields: ScoredCampaign["matchedFields"] = [];
  const highlights: ScoredCampaign["highlights"] = {};

  const titleLow = campaign.title.toLowerCase();
  const descLow = campaign.description.toLowerCase();
  const catLow = (campaign.category ?? "").toLowerCase();
  const creatorLow = campaign.creator.toLowerCase();
  const rawLow = rawQuery.toLowerCase();

  // Exact phrase match (highest weight)
  if (titleLow.includes(rawLow)) {
    score += weights.titleExactPhrase;
    if (!matchedFields.includes("title")) matchedFields.push("title");
    highlights.title = highlight(campaign.title, rawQuery);
  }
  if (descLow.includes(rawLow)) {
    score += weights.descriptionExactPhrase;
    if (!matchedFields.includes("description"))
      matchedFields.push("description");
    if (!highlights.description)
      highlights.description = highlight(campaign.description, rawQuery);
  }

  // Per-token scoring
  for (const token of queryTokens) {
    if (titleLow.includes(token)) {
      score += weights.titleToken;
      if (!matchedFields.includes("title")) matchedFields.push("title");
      if (!highlights.title)
        highlights.title = highlight(campaign.title, token);
    } else if (fuzzyMatch(token, campaign.title)) {
      score += weights.titleFuzzy;
      if (!matchedFields.includes("title")) matchedFields.push("title");
    }

    if (descLow.includes(token)) {
      score += weights.descriptionToken;
      if (!matchedFields.includes("description"))
        matchedFields.push("description");
      if (!highlights.description)
        highlights.description = highlight(campaign.description, token);
    } else if (fuzzyMatch(token, campaign.description)) {
      score += weights.descriptionFuzzy;
      if (!matchedFields.includes("description"))
        matchedFields.push("description");
    }

    if (catLow === token || catLow.includes(token)) {
      score += weights.categoryToken;
      if (!matchedFields.includes("category")) matchedFields.push("category");
    }

    if (creatorLow.includes(token)) {
      score += weights.creatorToken;
      if (!matchedFields.includes("creator")) matchedFields.push("creator");
    }
  }

  // Semantic expansion scoring (lower weight than direct token matches)
  const semanticOnly = expandedTokens.filter((t) => !queryTokens.includes(t));
  for (const token of semanticOnly) {
    if (titleLow.includes(token)) score += weights.semanticTitle;
    else if (descLow.includes(token)) score += weights.semanticDescription;
    if (catLow.includes(token)) score += weights.categorySemantic;
  }

  // Personalization: boost campaigns whose category the user has viewed more
  if (campaign.category) {
    const views = preferences.categoryViews[campaign.category] ?? 0;
    const boost = Math.min(
      weights.categoryBoostMax,
      1 + views * weights.categoryBoostRate,
    );
    score *= boost;
  }

  return { score, matchedFields, highlights };
}

// ── Facets ────────────────────────────────────────────────────────────────────

function computeFacets(campaigns: Campaign[]): SearchFacets {
  const catCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  let goalMin = Infinity;
  let goalMax = -Infinity;

  for (const c of campaigns) {
    if (c.category) catCounts[c.category] = (catCounts[c.category] ?? 0) + 1;
    const s = getCampaignStatusValue(c);
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    goalMin = Math.min(goalMin, c.goal);
    goalMax = Math.max(goalMax, c.goal);
  }

  return {
    categories: Object.entries(catCounts)
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count),
    statuses: Object.entries(statusCounts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    goalRange: {
      min: goalMin === Infinity ? 0 : goalMin,
      max: goalMax === -Infinity ? 0 : goalMax,
    },
  };
}

// ── Main search function ──────────────────────────────────────────────────────

export function advancedSearch(
  campaigns: Campaign[],
  filters: SearchFilters,
  preferences?: UserPreferences,
): SearchResult {
  const start = performance.now();
  const prefs = preferences ?? { categoryViews: {}, recentSearches: [] };
  const {
    query: rawQuery = "",
    category,
    status = "all",
    goalMin,
    goalMax,
    dateFrom,
    dateTo,
    sort = "newest",
    page = 1,
    pageSize = 9,
  } = filters ?? {};

  const query = rawQuery ?? "";
  const queryTokens = tokenize(query);
  const expandedTokens = expandQuery(queryTokens);
  const hasQuery = query.trim().length > 0;

  const scored: ScoredCampaign[] = [];

  for (const campaign of campaigns) {
    // Apply deterministic filters first (fast path)
    if (category && campaign.category !== category) continue;
    if (status !== "all" && getCampaignStatusValue(campaign) !== status)
      continue;
    if (goalMin !== undefined && campaign.goal < goalMin) continue;
    if (goalMax !== undefined && campaign.goal > goalMax) continue;
    if (dateFrom && new Date(campaign.deadline) < new Date(dateFrom)) continue;
    if (dateTo && new Date(campaign.deadline) > new Date(dateTo)) continue;

    const { score, matchedFields, highlights } = scoreCampaign(
      campaign,
      queryTokens,
      expandedTokens,
      query,
      prefs,
    );

    // When a query is present, exclude zero-score campaigns
    if (hasQuery && score === 0) continue;

    scored.push({ campaign, score, matchedFields, highlights });
  }

  // Sort results
  // Treat "recent" as "newest" for backward URL compatibility
  const normSort = sort === "recent" ? "newest" : sort;
  const effectiveSort =
    hasQuery && normSort === "newest" ? "relevance" : normSort;
  if (effectiveSort === "relevance") {
    scored.sort((a, b) => b.score - a.score);
  } else if (effectiveSort === "most-funded") {
    scored.sort(
      (a, b) =>
        b.campaign.raised / b.campaign.goal -
        a.campaign.raised / a.campaign.goal,
    );
  } else if (effectiveSort === "ending-soon") {
    scored.sort(
      (a, b) =>
        new Date(a.campaign.deadline).getTime() -
        new Date(b.campaign.deadline).getTime(),
    );
  } else if (effectiveSort === "trending") {
    scored.sort(
      (a, b) =>
        (b.campaign.contributorCount ?? 0) - (a.campaign.contributorCount ?? 0),
    );
  } else {
    // newest
    scored.sort((a, b) => Number(b.campaign.id) - Number(a.campaign.id));
  }

  const total = scored.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = scored.slice((page - 1) * pageSize, page * pageSize);
  const facets = computeFacets(scored.map((s) => s.campaign));

  // "Did you mean?" suggestion when query returns nothing
  let didYouMean: string | undefined;
  if (hasQuery && total === 0) {
    const allTokens = campaigns.flatMap((c) =>
      tokenize(c.title + " " + c.description),
    );
    for (const token of queryTokens) {
      const close = allTokens.find(
        (t) => t !== token && t.length > 3 && editDistance(token, t) === 1,
      );
      if (close) {
        didYouMean = query.toLowerCase().replace(token, close);
        break;
      }
    }
  }

  return {
    items,
    total,
    totalPages,
    facets,
    durationMs: Math.round(performance.now() - start),
    didYouMean,
  };
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export function getSearchSuggestions(
  campaigns: Campaign[],
  query: string,
  limit = 6,
): Array<{ id: string; title: string; category?: string }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const lower = trimmed.toLowerCase();
  const tokens = tokenize(trimmed);

  return campaigns
    .filter((c) => {
      const titleLow = c.title.toLowerCase();
      const descLow = c.description.toLowerCase();
      if (titleLow.includes(lower) || descLow.includes(lower)) return true;
      return tokens.some((t) => titleLow.includes(t) || fuzzyMatch(t, c.title));
    })
    .slice(0, limit)
    .map((c) => ({ id: c.id, title: c.title, category: c.category }));
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function getRecommendations(
  campaigns: Campaign[],
  preferences: UserPreferences,
  excludeIds: string[] = [],
  limit = 3,
): { campaigns: Campaign[]; reason: string } {
  const excludeSet = new Set(excludeIds);
  const available = campaigns.filter((c) => !excludeSet.has(c.id));

  if (Object.keys(preferences.categoryViews).length > 0) {
    const byPreference = available
      .filter(
        (c) => c.category && (preferences.categoryViews[c.category] ?? 0) > 0,
      )
      .sort(
        (a, b) =>
          (preferences.categoryViews[b.category ?? ""] ?? 0) -
          (preferences.categoryViews[a.category ?? ""] ?? 0),
      )
      .slice(0, limit);

    if (byPreference.length > 0) {
      return { campaigns: byPreference, reason: "Based on your interests" };
    }
  }

  // Fallback: most-contributors among active campaigns
  const trending = available
    .filter((c) => getCampaignStatusValue(c) === "active")
    .sort((a, b) => (b.contributorCount ?? 0) - (a.contributorCount ?? 0))
    .slice(0, limit);
  return { campaigns: trending, reason: "Trending campaigns" };
}

// ── User preferences persistence ──────────────────────────────────────────────

const DEFAULT_PREFS: UserPreferences = {
  categoryViews: {},
  recentSearches: [],
};

export function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as UserPreferences) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

export function recordSearch(
  query: string,
  preferences: UserPreferences,
): UserPreferences {
  if (!query.trim()) return preferences;
  const recent = [
    query,
    ...preferences.recentSearches.filter((q) => q !== query),
  ].slice(0, 10);
  return { ...preferences, recentSearches: recent };
}

export function recordCategoryView(
  category: string,
  preferences: UserPreferences,
): UserPreferences {
  return {
    ...preferences,
    categoryViews: {
      ...preferences.categoryViews,
      [category]: (preferences.categoryViews[category] ?? 0) + 1,
    },
  };
}
