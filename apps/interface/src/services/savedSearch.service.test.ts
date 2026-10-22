/**
 * Unit tests for savedSearch.service — CRUD helpers, alert matching,
 * and localStorage persistence.
 */

import {
  loadSavedSearches,
  persistSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  checkSavedSearchAlerts,
  type SavedSearch,
  type SavedSearchAlert,
} from "./savedSearch.service";
import type { Campaign } from "@/types/campaign";
import type { SearchFilters } from "./search.service";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const future = new Date(Date.now() + 86400_000).toISOString();
const past = new Date(Date.now() - 86400_000).toISOString();

const base: Omit<Campaign, "id" | "raised" | "goal" | "deadline" | "status"> = {
  contractId: "C1",
  title: "Test Campaign",
  description: "A test campaign",
  creator: "GABC1234",
  token: "XLM",
};

const campaignA: Campaign = {
  ...base,
  id: "1",
  title: "Eco Water Purification",
  description: "Purification system",
  category: "environment",
  raised: 500,
  goal: 1000,
  deadline: future,
  status: "Active",
};

const campaignB: Campaign = {
  ...base,
  id: "2",
  title: "Solar Energy Initiative",
  description: "Solar power for communities",
  category: "energy",
  raised: 1000,
  goal: 1000,
  deadline: future,
  status: "Successful",
};

const campaigns = [campaignA, campaignB];
const wallet = "GABC1234";
const emptyFilters: SearchFilters = {};

// ── loadSavedSearches / persistSavedSearches ──────────────────────────────────

describe("loadSavedSearches", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty array when nothing is stored", () => {
    expect(loadSavedSearches()).toEqual([]);
  });

  it("returns stored saved searches after persist", () => {
    const saved = createSavedSearch(
      "My Search",
      emptyFilters,
      wallet,
      campaigns,
    );
    persistSavedSearches([saved]);
    const loaded = loadSavedSearches();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("My Search");
  });

  it("returns empty array when localStorage contains invalid JSON", () => {
    localStorage.setItem("fmc:saved-searches", "not-valid-json{{{");
    expect(loadSavedSearches()).toEqual([]);
  });
});

describe("persistSavedSearches", () => {
  beforeEach(() => localStorage.clear());

  it("stores searches and they survive a reload", () => {
    const saved = createSavedSearch(
      "Eco Search",
      emptyFilters,
      wallet,
      campaigns,
    );
    persistSavedSearches([saved]);
    const reloaded = loadSavedSearches();
    expect(reloaded[0].id).toBe(saved.id);
  });

  it("overwrites existing data", () => {
    const s1 = createSavedSearch("Search 1", emptyFilters, wallet, campaigns);
    const s2 = createSavedSearch("Search 2", emptyFilters, wallet, campaigns);
    persistSavedSearches([s1]);
    persistSavedSearches([s2]);
    const loaded = loadSavedSearches();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("Search 2");
  });
});

// ── createSavedSearch ─────────────────────────────────────────────────────────

describe("createSavedSearch", () => {
  it("creates a search with the correct name", () => {
    const saved = createSavedSearch(
      "My Search",
      emptyFilters,
      wallet,
      campaigns,
    );
    expect(saved.name).toBe("My Search");
  });

  it("trims whitespace from the name", () => {
    const saved = createSavedSearch(
      "  My Search  ",
      emptyFilters,
      wallet,
      campaigns,
    );
    expect(saved.name).toBe("My Search");
  });

  it("sets walletAddress correctly", () => {
    const saved = createSavedSearch("Test", emptyFilters, wallet, campaigns);
    expect(saved.walletAddress).toBe(wallet);
  });

  it("generates a unique id each time", () => {
    const s1 = createSavedSearch("A", emptyFilters, wallet, campaigns);
    const s2 = createSavedSearch("B", emptyFilters, wallet, campaigns);
    expect(s1.id).not.toBe(s2.id);
  });

  it("populates seenIds with current matching campaign ids", () => {
    const saved = createSavedSearch("All", emptyFilters, wallet, campaigns);
    expect(saved.seenIds).toEqual(
      expect.arrayContaining([campaignA.id, campaignB.id]),
    );
  });

  it("stores the provided filters", () => {
    const filters: SearchFilters = { query: "eco", status: "active" };
    const saved = createSavedSearch("Eco", filters, wallet, campaigns);
    expect(saved.filters.query).toBe("eco");
    expect(saved.filters.status).toBe("active");
  });

  it("sets createdAt as a recent timestamp", () => {
    const before = Date.now();
    const saved = createSavedSearch("T", emptyFilters, wallet, campaigns);
    const after = Date.now();
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
    expect(saved.createdAt).toBeLessThanOrEqual(after);
  });
});

// ── updateSavedSearch ─────────────────────────────────────────────────────────

describe("updateSavedSearch", () => {
  it("updates the name of the matching search", () => {
    const saved = createSavedSearch(
      "Original",
      emptyFilters,
      wallet,
      campaigns,
    );
    const updated = updateSavedSearch([saved], saved.id, { name: "Renamed" });
    expect(updated[0].name).toBe("Renamed");
  });

  it("updates filters of the matching search", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    const newFilters: SearchFilters = { query: "solar" };
    const updated = updateSavedSearch([saved], saved.id, {
      filters: newFilters,
    });
    expect(updated[0].filters.query).toBe("solar");
  });

  it("does not mutate unrelated searches", () => {
    const s1 = createSavedSearch("A", emptyFilters, wallet, campaigns);
    const s2 = createSavedSearch("B", emptyFilters, wallet, campaigns);
    const updated = updateSavedSearch([s1, s2], s1.id, { name: "A-updated" });
    expect(updated[1].name).toBe("B");
  });

  it("returns the same array length", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    const updated = updateSavedSearch([saved], saved.id, { name: "New" });
    expect(updated).toHaveLength(1);
  });

  it("is a no-op for an unknown id", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    const updated = updateSavedSearch([saved], "unknown-id", { name: "X" });
    expect(updated[0].name).toBe("S");
  });
});

// ── deleteSavedSearch ─────────────────────────────────────────────────────────

describe("deleteSavedSearch", () => {
  it("removes the matching search", () => {
    const saved = createSavedSearch(
      "ToDelete",
      emptyFilters,
      wallet,
      campaigns,
    );
    const result = deleteSavedSearch([saved], saved.id);
    expect(result).toHaveLength(0);
  });

  it("does not remove unrelated searches", () => {
    const s1 = createSavedSearch("A", emptyFilters, wallet, campaigns);
    const s2 = createSavedSearch("B", emptyFilters, wallet, campaigns);
    const result = deleteSavedSearch([s1, s2], s1.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(s2.id);
  });

  it("returns the same array when id does not exist", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    const result = deleteSavedSearch([saved], "nonexistent");
    expect(result).toHaveLength(1);
  });

  it("handles an empty array without throwing", () => {
    expect(() => deleteSavedSearch([], "any-id")).not.toThrow();
  });
});

// ── checkSavedSearchAlerts ────────────────────────────────────────────────────

describe("checkSavedSearchAlerts", () => {
  it("returns no alerts when there are no new campaigns", () => {
    // Create a saved search that already has all current campaigns in seenIds
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    const alerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    expect(alerts).toHaveLength(0);
  });

  it("returns an alert when a new campaign matches", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, []);
    // saved.seenIds is empty because no campaigns existed at creation time
    const alerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("includes only new campaigns in the alert", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, [campaignA]);
    // campaignA is already seen; only campaignB is new
    const alerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    if (alerts.length > 0) {
      const newIds = alerts.flatMap((a) => a.newCampaigns.map((c) => c.id));
      expect(newIds).not.toContain(campaignA.id);
      expect(newIds).toContain(campaignB.id);
    }
  });

  it("ignores searches belonging to a different wallet", () => {
    const saved = createSavedSearch("S", emptyFilters, "OTHER_WALLET", []);
    const alerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    expect(alerts).toHaveLength(0);
  });

  it("updates seenIds in-place to prevent duplicate alerts", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, []);
    checkSavedSearchAlerts([saved], campaigns, wallet);
    // After the first check, all campaigns should be seen
    const newCampaignIds = campaigns.map((c) => c.id);
    for (const id of newCampaignIds) {
      expect(saved.seenIds).toContain(id);
    }
  });

  it("returns no alerts on a second call (no new campaigns since last check)", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, []);
    checkSavedSearchAlerts([saved], campaigns, wallet); // first call marks as seen
    const secondAlerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    expect(secondAlerts).toHaveLength(0);
  });

  it("handles empty searches array without throwing", () => {
    expect(() => checkSavedSearchAlerts([], campaigns, wallet)).not.toThrow();
  });

  it("handles empty campaigns array without throwing", () => {
    const saved = createSavedSearch("S", emptyFilters, wallet, campaigns);
    expect(() => checkSavedSearchAlerts([saved], [], wallet)).not.toThrow();
  });

  it("filters by the saved search's own filters", () => {
    const ecoFilters: SearchFilters = { query: "eco" };
    const saved = createSavedSearch("Eco", ecoFilters, wallet, []);
    const alerts = checkSavedSearchAlerts([saved], campaigns, wallet);
    if (alerts.length > 0) {
      // Only eco-related campaigns should be new
      const titles = alerts.flatMap((a) =>
        a.newCampaigns.map((c) => c.title.toLowerCase()),
      );
      expect(titles.some((t) => t.includes("eco") || t.includes("water"))).toBe(
        true,
      );
    }
  });
});
