import { describe, it, expect, vi } from "vitest";
import {
  TRACE_ID_HEADER,
  generateTraceId,
  isValidTraceId,
  resolveTraceId,
} from "../trace";

describe("Trace-ID utilities", () => {
  describe("TRACE_ID_HEADER", () => {
    it("is the canonical lowercase header name", () => {
      expect(TRACE_ID_HEADER).toBe("x-trace-id");
    });
  });

  describe("generateTraceId", () => {
    it("generates a string matching the fmc-<ts>-<random> format", () => {
      const id = generateTraceId();
      expect(id).toMatch(/^fmc-[0-9a-f]{8}-[0-9a-f]{16}$/);
    });

    it("generates unique IDs across multiple calls", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
      expect(ids.size).toBe(100);
    });

    it("total length is 29 characters", () => {
      const id = generateTraceId();
      expect(id.length).toBe(29);
    });

    it("uses Math.random fallback when crypto is unavailable", () => {
      const originalCrypto = globalThis.crypto;
      try {
        Object.defineProperty(globalThis, "crypto", {
          value: undefined,
          writable: true,
          configurable: true,
        });
        const id = generateTraceId();
        expect(id).toMatch(/^fmc-[0-9a-f]{8}-[0-9a-f]{16}$/);
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });

    it("uses Math.random fallback when crypto.getRandomValues is not a function", () => {
      const originalCrypto = globalThis.crypto;
      try {
        Object.defineProperty(globalThis, "crypto", {
          value: { getRandomValues: null },
          writable: true,
          configurable: true,
        });
        const id = generateTraceId();
        expect(id).toMatch(/^fmc-[0-9a-f]{8}-[0-9a-f]{16}$/);
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe("isValidTraceId", () => {
    it("returns true for a well-formed trace ID", () => {
      expect(isValidTraceId("fmc-67946a1b-3f8c2a0d9e4b71c2")).toBe(true);
    });

    it("returns true for any fmc-<8hex>-<16hex> string", () => {
      const id = generateTraceId();
      expect(isValidTraceId(id)).toBe(true);
    });

    it("returns false for non-strings", () => {
      expect(isValidTraceId(null)).toBe(false);
      expect(isValidTraceId(undefined)).toBe(false);
      expect(isValidTraceId(42)).toBe(false);
      expect(isValidTraceId({})).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidTraceId("")).toBe(false);
    });

    it("returns false for wrong prefix", () => {
      expect(isValidTraceId("abc-67946a1b-3f8c2a0d9e4b71c2")).toBe(false);
    });

    it("returns false for too-short random part", () => {
      expect(isValidTraceId("fmc-67946a1b-3f8c2a0d")).toBe(false);
    });

    it("returns false for too-long random part", () => {
      expect(isValidTraceId("fmc-67946a1b-3f8c2a0d9e4b71c200")).toBe(false);
    });

    it("returns false for uppercase hex", () => {
      expect(isValidTraceId("fmc-67946A1B-3f8c2a0d9e4b71c2")).toBe(false);
    });

    it("returns false for non-hex characters", () => {
      expect(isValidTraceId("fmc-67946g1b-3f8c2a0d9e4b71c2")).toBe(false);
    });
  });

  describe("resolveTraceId", () => {
    it("returns the valid trace ID from the headers", () => {
      const valid = "fmc-67946a1b-3f8c2a0d9e4b71c2";
      const result = resolveTraceId({ "x-trace-id": valid });
      expect(result).toBe(valid);
    });

    it("generates a new ID when header is missing", () => {
      const result = resolveTraceId({});
      expect(isValidTraceId(result)).toBe(true);
    });

    it("generates a new ID when header is malformed", () => {
      const result = resolveTraceId({ "x-trace-id": "not-valid" });
      expect(isValidTraceId(result)).toBe(true);
      expect(result).not.toBe("not-valid");
    });

    it("handles array header values", () => {
      const valid = "fmc-67946a1b-3f8c2a0d9e4b71c2";
      const result = resolveTraceId({ "x-trace-id": [valid, "extra"] });
      expect(result).toBe(valid);
    });

    it("generates a new ID when the first array value is malformed", () => {
      const result = resolveTraceId({
        "x-trace-id": ["invalid", "also-invalid"],
      });
      expect(isValidTraceId(result)).toBe(true);
    });
  });
});
