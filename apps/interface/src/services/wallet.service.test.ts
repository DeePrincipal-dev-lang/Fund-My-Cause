import {
  saveSession,
  loadSession,
  clearSession,
  isNetworkMatch,
  classifySignError,
} from "@/services/wallet.service";

// ── wallet.service ────────────────────────────────────────────────────────────

describe("session helpers", () => {
  beforeEach(() => sessionStorage.clear());

  it("saves and loads a session", () => {
    saveSession("GABC", "freighter");
    expect(loadSession()).toEqual({ address: "GABC", walletType: "freighter" });
  });

  it("returns null when no session", () => {
    expect(loadSession()).toBeNull();
  });

  it("clears session", () => {
    saveSession("GABC", "lobstr");
    clearSession();
    expect(loadSession()).toBeNull();
  });
});

describe("isNetworkMatch", () => {
  it("matches the mock passphrase", () => {
    expect(isNetworkMatch("Test SDF Network ; September 2015")).toBe(true);
  });
  it("rejects a different passphrase", () => {
    expect(
      isNetworkMatch("Public Global Stellar Network ; September 2015"),
    ).toBe(false);
  });
});

describe("classifySignError", () => {
  it("classifies cancellation", () => {
    expect(classifySignError(new Error("User rejected"))).toBe("cancelled");
    expect(classifySignError(new Error("declined by user"))).toBe("cancelled");
  });
  it("classifies network errors", () => {
    expect(classifySignError(new Error("network timeout"))).toBe("network");
    expect(classifySignError(new Error("fetch failed"))).toBe("network");
  });
  it("classifies unknown errors", () => {
    expect(classifySignError(new Error("something else"))).toBe("unknown");
    expect(classifySignError("not an error")).toBe("unknown");
  });
});
