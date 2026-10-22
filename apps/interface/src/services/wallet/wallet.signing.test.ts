import { classifySignError } from "./wallet.signing";

describe("wallet.signing — classifySignError", () => {
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
