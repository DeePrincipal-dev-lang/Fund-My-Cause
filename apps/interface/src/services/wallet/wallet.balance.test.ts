/**
 * Balance module is a placeholder (#1575) — no app-level balance logic yet.
 * This test pins the module's public surface so accidental exports are caught.
 */
import * as balance from "./wallet.balance";

describe("wallet.balance", () => {
  it("exports no public API yet", () => {
    expect(Object.keys(balance)).toEqual([]);
  });
});
