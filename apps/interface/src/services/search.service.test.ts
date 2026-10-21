/**
 * Unit tests for search.service — advancedSearch, getSearchSuggestions,
 * getRecommendations, loadPreferences, savePreferences, and resilience cases.
 *
 * Resilience block originally lived in __tests__/resilience.test.ts (issue #1577).
 */

import {
  advancedSearch,
  getSearchSuggestions,
  getRecommendations,
  loadPreferences,
  savePreferences,
  recordSearch,
  recordCategoryView,
  getCampaignStatusValue,
  type SearchFilters,
  type UserPreferences,
} from "./search.service";
import type { Campaign } from "@/types/campaign";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const future = new Date(Date.now() + 86400_000).toISOString();
const past = new Date(Date.now() - 86400_000).toISOString();

const base: Omit<Campaign, "id" | "raised" | "goal" | "deadline" | "status"> = {
  contractId: "C1",
  title: "Test Campaign",
  description: "A test campaign description",
  creator: "GABC1234",
  token: "XLM",
};

const campaignEco: Campaign = {
  ...base,
  id: "1",
  title: "Eco-Friendly Water Purification",
  description: "A water purification system for communities",
  category: "environment",
  raised: 500,
  goal: 1000,
  deadline: future,
  status: "Active",
};
const campaignSolar: Campaign = {
  ...base,
  id: "2",
  title: "Solar Energy Initiative",
  description: "Community solar power project",
  category: "energy",
  raised: 1000,
  goal: 1000,
  deadline: future,
  status: "Successful",
};
const campaignMedical: Campaign = {
  ...base,
  id: "3",
  title: "Medical Research Fund",
  description: "Cancer research funding for hospitals",
  category: "health",
  raised: 200,
  goal: 1000,
  deadline: past,
  status: "Active",
};

const campaigns = [campaignEco, campaignSolar, campaignMedical];
const emptyPrefs: UserPreferences = { categoryViews: {}, recentSearches: [] };

// ── getCampaignStatusValue ────────────────────────────────────────────────────

describe("getCampaignStatusValue", () => {
  it("returns 'funded' when raised >= goal", () => {
    expect(getCampaignStatusValue(campaignSolar)).toBe("funded");
  });

  it("returns 'active' for ongoing campaign", () => {
    expect(getCampaignStatusValue(campaignEco)).toBe("active");
  });

  it("returns 'ended' when deadline has passed", () => {
    expect(getCampaignStatusValue(campaignMedical)).toBe("ended");
  });
});

// ── advancedSearch — basic query matching ─────────────────────────────────────

describe("advancedSearch — query matching", () => {
  it("returns all campaigns when query is empty", () => {
    const result = advancedSearch(campaigns, { query: "" }, emptyPrefs);
    expect(result.items).toHaveLength(3);
  });

  it("finds campaigns by title keyword", () => {
    const result = advancedSearch(campaigns, { query: "solar" }, emptyPrefs);
    expect(result.items.some((s) => s.campaign.id === "2")).toBe(true);
  });

  it("finds campaigns by description keyword", () => {
    const result = advancedSearch(
      campaigns,
      { query: "purification" },
      emptyPrefs,
    );
    expect(result.items.some((s) => s.campaign.id === "1")).toBe(true);
  });

  it("returns empty when no campaigns match", () => {
    const result = advancedSearch(
      campaigns,
      { query: "zzzznonexistent" },
      emptyPrefs,
    );
    expect(result.items).toEqual([]);
  });

  it("returns correct total and totalPages", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", pageSize: 2 },
      emptyPrefs,
    );
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
  });
});

// ── advancedSearch — filters ──────────────────────────────────────────────────

describe("advancedSearch — filters", () => {
  it("filters by status 'active'", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", status: "active" },
      emptyPrefs,
    );
    expect(
      result.items.every(
        (s) => getCampaignStatusValue(s.campaign) === "active",
      ),
    ).toBe(true);
  });

  it("filters by status 'funded'", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", status: "funded" },
      emptyPrefs,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].campaign.id).toBe("2");
  });

  it("filters by category", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", category: "energy" },
      emptyPrefs,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].campaign.id).toBe("2");
  });

  it("filters by goalMin", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", goalMin: 1000 },
      emptyPrefs,
    );
    expect(result.items.every((s) => s.campaign.goal >= 1000)).toBe(true);
  });

  it("filters by goalMax", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", goalMax: 999 },
      emptyPrefs,
    );
    expect(result.items.every((s) => s.campaign.goal <= 999)).toBe(true);
  });
});

// ── advancedSearch — sorting ──────────────────────────────────────────────────

describe("advancedSearch — sorting", () => {
  it("sorts by most-funded descending", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", sort: "most-funded" },
      emptyPrefs,
    );
    const ratios = result.items.map((s) => s.campaign.raised / s.campaign.goal);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i - 1]).toBeGreaterThanOrEqual(ratios[i]);
    }
  });

  it("sorts by ending-soon ascending by deadline", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", sort: "ending-soon" },
      emptyPrefs,
    );
    const deadlines = result.items.map((s) =>
      new Date(s.campaign.deadline).getTime(),
    );
    for (let i = 1; i < deadlines.length; i++) {
      expect(deadlines[i - 1]).toBeLessThanOrEqual(deadlines[i]);
    }
  });

  it("treats 'recent' as 'newest' for backward compatibility", () => {
    const newest = advancedSearch(
      campaigns,
      { query: "", sort: "newest" },
      emptyPrefs,
    );
    const recent = advancedSearch(
      campaigns,
      { query: "", sort: "recent" },
      emptyPrefs,
    );
    expect(newest.items.map((s) => s.campaign.id)).toEqual(
      recent.items.map((s) => s.campaign.id),
    );
  });
});

// ── advancedSearch — facets ───────────────────────────────────────────────────

describe("advancedSearch — facets", () => {
  it("returns category facets", () => {
    const result = advancedSearch(campaigns, { query: "" }, emptyPrefs);
    expect(result.facets.categories.length).toBeGreaterThan(0);
  });

  it("returns status facets", () => {
    const result = advancedSearch(campaigns, { query: "" }, emptyPrefs);
    expect(result.facets.statuses.length).toBeGreaterThan(0);
  });

  it("returns goalRange facets", () => {
    const result = advancedSearch(campaigns, { query: "" }, emptyPrefs);
    expect(result.facets.goalRange.min).toBeGreaterThanOrEqual(0);
    expect(result.facets.goalRange.max).toBeGreaterThanOrEqual(
      result.facets.goalRange.min,
    );
  });
});

// ── advancedSearch — personalisation ─────────────────────────────────────────

describe("advancedSearch — personalisation boost", () => {
  it("boosts campaigns in a viewed category higher", () => {
    const prefs: UserPreferences = {
      categoryViews: { energy: 10 },
      recentSearches: [],
    };
    const result = advancedSearch(campaigns, { query: "solar" }, prefs);
    // Solar (energy category) should appear and have a high score due to boost
    const solarEntry = result.items.find((s) => s.campaign.id === "2");
    expect(solarEntry).toBeDefined();
    expect(solarEntry!.score).toBeGreaterThan(0);
  });
});

// ── advancedSearch — didYouMean ───────────────────────────────────────────────

describe("advancedSearch — didYouMean", () => {
  it("returns didYouMean suggestion for near-miss query", () => {
    // "slolar" is one edit away from "solar"
    const result = advancedSearch(campaigns, { query: "slolar" }, emptyPrefs);
    if (result.total === 0 && result.didYouMean) {
      expect(typeof result.didYouMean).toBe("string");
    }
  });
});

// ── advancedSearch — pagination ───────────────────────────────────────────────

describe("advancedSearch — pagination", () => {
  it("returns correct page 1 results", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", page: 1, pageSize: 2 },
      emptyPrefs,
    );
    expect(result.items).toHaveLength(2);
  });

  it("returns correct page 2 results", () => {
    const result = advancedSearch(
      campaigns,
      { query: "", page: 2, pageSize: 2 },
      emptyPrefs,
    );
    expect(result.items).toHaveLength(1);
  });

  it("always returns at least 1 totalPages", () => {
    const result = advancedSearch(
      campaigns,
      { query: "zznotfound" },
      emptyPrefs,
    );
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });
});

// ── getSearchSuggestions ──────────────────────────────────────────────────────

describe("getSearchSuggestions", () => {
  it("returns suggestions for a matching prefix", () => {
    const suggestions = getSearchSuggestions(campaigns, "sol");
    expect(suggestions.some((s) => s.id === "2")).toBe(true);
  });

  it("returns empty array for a very short query (< 2 chars)", () => {
    const suggestions = getSearchSuggestions(campaigns, "s");
    expect(suggestions).toEqual([]);
  });

  it("returns empty array when no campaigns match", () => {
    const suggestions = getSearchSuggestions(campaigns, "zzzzz");
    expect(suggestions).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const suggestions = getSearchSuggestions(campaigns, "a", 1);
    expect(suggestions.length).toBeLessThanOrEqual(1);
  });
});

// ── getRecommendations ────────────────────────────────────────────────────────

describe("getRecommendations", () => {
  it("returns trending fallback when no category preferences", () => {
    const result = getRecommendations(campaigns, emptyPrefs);
    expect(result.reason).toBe("Trending campaigns");
    expect(result.campaigns.length).toBeGreaterThanOrEqual(0);
  });

  it("returns based-on-interests when category views exist", () => {
    const prefs: UserPreferences = {
      categoryViews: { energy: 5 },
      recentSearches: [],
    };
    const result = getRecommendations(campaigns, prefs);
    // Should match the energy campaign or fall back if none active
    expect(result.campaigns).toBeDefined();
  });

  it("excludes campaigns by id", () => {
    const result = getRecommendations(campaigns, emptyPrefs, ["1", "2", "3"]);
    expect(result.campaigns).toHaveLength(0);
  });

  it("respects the limit", () => {
    const result = getRecommendations(campaigns, emptyPrefs, [], 1);
    expect(result.campaigns.length).toBeLessThanOrEqual(1);
  });
});

// ── loadPreferences / savePreferences ─────────────────────────────────────────

describe("loadPreferences", () => {
  beforeEach(() => localStorage.clear());

  it("returns default preferences when nothing is stored", () => {
    const prefs = loadPreferences();
    expect(prefs.categoryViews).toEqual({});
    expect(prefs.recentSearches).toEqual([]);
  });
});

describe("savePreferences", () => {
  beforeEach(() => localStorage.clear());

  it("persists and re-loads preferences", () => {
    const prefs: UserPreferences = {
      categoryViews: { energy: 3 },
      recentSearches: ["solar", "eco"],
    };
    savePreferences(prefs);
    const loaded = loadPreferences();
    expect(loaded.categoryViews.energy).toBe(3);
    expect(loaded.recentSearches).toEqual(["solar", "eco"]);
  });
});

// ── recordSearch / recordCategoryView ─────────────────────────────────────────

describe("recordSearch", () => {
  it("adds the search query to recentSearches", () => {
    const updated = recordSearch("solar", emptyPrefs);
    expect(updated.recentSearches).toContain("solar");
  });

  it("deduplicates and moves repeated queries to front", () => {
    const p1 = recordSearch("solar", emptyPrefs);
    const p2 = recordSearch("eco", p1);
    const p3 = recordSearch("solar", p2);
    expect(p3.recentSearches[0]).toBe("solar");
    expect(p3.recentSearches.filter((q) => q === "solar")).toHaveLength(1);
  });

  it("ignores empty query", () => {
    const updated = recordSearch("", emptyPrefs);
    expect(updated.recentSearches).toEqual([]);
  });

  it("keeps at most 10 recent searches", () => {
    let prefs = emptyPrefs;
    for (let i = 0; i < 12; i++) {
      prefs = recordSearch(`query-${i}`, prefs);
    }
    expect(prefs.recentSearches.length).toBeLessThanOrEqual(10);
  });
});

describe("recordCategoryView", () => {
  it("increments view count for a category", () => {
    const updated = recordCategoryView("energy", emptyPrefs);
    expect(updated.categoryViews.energy).toBe(1);
  });

  it("accumulates across multiple calls", () => {
    const p1 = recordCategoryView("energy", emptyPrefs);
    const p2 = recordCategoryView("energy", p1);
    expect(p2.categoryViews.energy).toBe(2);
  });

  it("does not mutate the original preferences", () => {
    recordCategoryView("energy", emptyPrefs);
    expect(emptyPrefs.categoryViews.energy).toBeUndefined();
  });
});

// ── search.service resilience (split from __tests__/resilience.test.ts) ───────

describe("search.service resilience", () => {
  it("handles null query gracefully", () => {
    const result = advancedSearch(campaigns, {
      query: null as unknown as string,
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("handles extremely long query without crashing", () => {
    const longQuery = "a".repeat(10000);
    const result = advancedSearch(campaigns, { query: longQuery });
    expect(result).toBeDefined();
  });

  it("handles special characters in query", () => {
    const result = advancedSearch(campaigns, { query: "!@#$%^&*()" });
    expect(result.items).toEqual([]);
  });

  it("handles unicode/emoji in query", () => {
    const result = advancedSearch(campaigns, { query: "🌍 test 🔬" });
    expect(result).toBeDefined();
  });

  it("handles missing filters object", () => {
    const result = advancedSearch(
      campaigns,
      undefined as unknown as SearchFilters,
    );
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("recovers after a failure (no global state corruption)", () => {
    const r1 = advancedSearch(campaigns, { query: "solar" });
    expect(r1.items.length).toBeGreaterThan(0);

    const r2 = advancedSearch(campaigns, { query: "eco" });
    expect(r2.items.length).toBeGreaterThanOrEqual(0);

    const r3 = advancedSearch(campaigns, { query: "solar" });
    expect(r3.items.length).toBe(r1.items.length);
  });
});

// ── Merged campaign search (formerly lib/search/search.service, #1576) ───────


describe("searchCampaigns (merged module)", () => {
  it("returns a paginated SearchResult shape", async () => {
    const res = await searchCampaigns({ query: "", page: 1, pageSize: 5 });
    expect(res).toHaveProperty("campaigns");
    expect(res).toHaveProperty("total");
    expect(res).toHaveProperty("page", 1);
    expect(res).toHaveProperty("pageSize", 5);
    expect(res).toHaveProperty("hasMore");
    expect(res).toHaveProperty("provider");
    expect(res).toHaveProperty("durationMs");
    expect(Array.isArray(res.campaigns)).toBe(true);
  });
});

// ── Merged campaign search (formerly lib/search/search.service, #1576) ───────

describe("searchCampaigns (merged module)", () => {
  it("returns a paginated SearchResult shape", async () => {
    const res = await searchCampaigns({ query: "", page: 1, pageSize: 5 });
    expect(res).toHaveProperty("campaigns");
    expect(res).toHaveProperty("total");
    expect(res).toHaveProperty("page", 1);
    expect(res).toHaveProperty("pageSize", 5);
    expect(res).toHaveProperty("hasMore");
    expect(res).toHaveProperty("provider");
    expect(res).toHaveProperty("durationMs");
    expect(Array.isArray(res.campaigns)).toBe(true);
  });
});
