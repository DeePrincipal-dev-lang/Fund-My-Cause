/**
 * Keeps DATALOADER_AUDIT.md in sync with the loaders built by createLoaders (#1464).
 *
 * The audit file is the checklist for which DataLoader paths exist. Every
 * loader that createLoaders creates must be documented there, and every
 * loader-style name the audit mentions must still exist.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { createLoaders, type DataSources } from "./loaders.js";

const AUDIT_PATH = join(__dirname, "DATALOADER_AUDIT.md");

function stubDataSources(): DataSources {
  return {
    getUsersByIds: vi.fn(async () => []),
    getCampaignsByIds: vi.fn(async () => []),
    getContributionsByCampaignIds: vi.fn(async () => []),
  };
}

describe("DATALOADER_AUDIT.md sync (#1464)", () => {
  const loaderNames = Object.keys(createLoaders(stubDataSources())).sort();
  const audit = readFileSync(AUDIT_PATH, "utf-8");

  it("documents every loader that createLoaders builds", () => {
    const undocumented = loaderNames.filter(
      (name) => !audit.includes(`\`${name}\``),
    );
    expect(undocumented).toEqual([]);
  });

  it("does not reference loader names that no longer exist", () => {
    const mentioned = new Set(
      [...audit.matchAll(/`([a-z][A-Za-z]*(?:ById|ByCampaignId))`/g)].map(
        (m) => m[1],
      ),
    );
    const stale = [...mentioned].filter((name) => !loaderNames.includes(name));
    expect(stale).toEqual([]);
  });
});
