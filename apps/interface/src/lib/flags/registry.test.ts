/**
 * Registry contract tests (#1574).
 *
 * These don't test flag *behaviour* (there are no flags yet) — they pin the
 * structural invariants that make "no orphaned flags" true by construction.
 */
import { FLAGS, FLAG_KEYS, isEnabled, isFlagKey, getFlag, type FlagKey } from "./registry";

describe("flag registry — structural invariants", () => {
  it("FLAG_KEYS matches FLAGS exactly (no drift)", () => {
    expect(new Set(FLAG_KEYS)).toEqual(new Set(Object.keys(FLAGS) as FlagKey[]));
  });

  it("every key in FLAGS is its own name", () => {
    for (const [key, def] of Object.entries(FLAGS)) {
      expect(def.name).toBe(key);
    }
  });

  it("every definition has a valid rolloutPercentage in [0, 100]", () => {
    for (const def of Object.values(FLAGS)) {
      expect(def.rolloutPercentage).toBeGreaterThanOrEqual(0);
      expect(def.rolloutPercentage).toBeLessThanOrEqual(100);
    }
  });
});

describe("isFlagKey", () => {
  it("returns true for every registered key", () => {
    for (const key of FLAG_KEYS) expect(isFlagKey(key)).toBe(true);
  });

  it("returns false for unknown strings", () => {
    expect(isFlagKey("definitely_not_a_flag")).toBe(false);
    expect(isFlagKey("")).toBe(false);
  });
});

describe("isEnabled / getFlag", () => {
  it("isEnabled returns a boolean for every registered key", () => {
    for (const key of FLAG_KEYS) {
      expect(typeof isEnabled(key)).toBe("boolean");
    }
  });

  it("getFlag returns the definition for every registered key", () => {
    for (const key of FLAG_KEYS) {
      expect(getFlag(key)).toEqual(FLAGS[key]);
    }
  });

  it("isEnabled throws on unknown keys outside production", () => {
    // TypeScript forbids this — cast to exercise the runtime guard.
    const bogus = "made_up_flag" as unknown as FlagKey;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      expect(() => isEnabled(bogus)).toThrow(/Unknown flag/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("getFlag returns undefined for unknown keys", () => {
    const bogus = "made_up_flag" as unknown as FlagKey;
    expect(getFlag(bogus)).toBeUndefined();
  });
});
