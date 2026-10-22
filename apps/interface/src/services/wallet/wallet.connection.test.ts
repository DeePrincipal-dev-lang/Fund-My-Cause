import {
  SESSION_KEY,
  SESSION_WALLET_KEY,
  saveSession,
  loadSession,
  clearSession,
} from "./wallet.connection";

describe("wallet.connection", () => {
  beforeEach(() => sessionStorage.clear());

  it("exposes stable session storage keys", () => {
    expect(SESSION_KEY).toBe("fmc:wallet_address");
    expect(SESSION_WALLET_KEY).toBe("fmc:wallet_type");
  });

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
