import { describe, expect, it } from "vitest";
import { AppError, type AppErrorSeverity } from "../errors";

describe("AppError", () => {
  it("serializes to a stable object shape with code and context", () => {
    const err = new AppError("CONTRACT_FAILED", "Campaign failed", {
      severity: "error",
      context: { campaignId: "cmp_123", step: "funding" },
      cause: new Error("bad gateway"),
    });

    expect(err.name).toBe("AppError");
    expect(err.code).toBe("CONTRACT_FAILED");
    expect(err.message).toBe("Campaign failed");
    expect(err.context).toEqual({ campaignId: "cmp_123", step: "funding" });
    expect(err.severity).toBe("error" as AppErrorSeverity);

    expect(JSON.parse(JSON.stringify(err))).toMatchObject({
      name: "AppError",
      code: "CONTRACT_FAILED",
      message: "Campaign failed",
      severity: "error",
      context: { campaignId: "cmp_123", step: "funding" },
    });
  });

  it("falls back to a default severity and empty context", () => {
    const err = new AppError("UNKNOWN");
    expect(err.severity).toBe("error");
    expect(err.context).toEqual({});
    expect(JSON.parse(JSON.stringify(err))).toMatchObject({
      code: "UNKNOWN",
      severity: "error",
      context: {},
    });
  });
});
