import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { AuthService } from "../auth.js";

// Covers the error-handling branches of AuthService (issue #1473 coverage floor).
describe("AuthService error paths", () => {
  const secret = "test-secret-key-32-chars-minimum!";
  let auth: AuthService;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auth = new AuthService(secret, "24h");
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateToken", () => {
    it("logs and rethrows when signing fails", () => {
      const bad = new AuthService(secret, "not-a-duration");

      expect(() => bad.generateToken("GADDRESS123")).toThrow();
      expect(consoleError).toHaveBeenCalledWith(
        "Error generating token:",
        expect.anything(),
      );
    });
  });

  describe("verifyToken", () => {
    it("returns null and logs for a token signed with another secret", () => {
      const foreign = new AuthService(
        "another-secret-key-that-is-32-chars!!",
        "24h",
      ).generateToken("GADDRESS123");

      expect(auth.verifyToken(foreign)).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "Error verifying token:",
        expect.anything(),
      );
    });
  });

  describe("decodeToken", () => {
    it("returns null and logs when jwt.decode throws", () => {
      vi.spyOn(jwt, "decode").mockImplementation(() => {
        throw new Error("boom");
      });

      expect(auth.decodeToken("anything")).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "Error decoding token:",
        expect.any(Error),
      );
    });
  });

  describe("isTokenExpired", () => {
    it("treats a token without an exp claim as expired", () => {
      const noExp = jwt.sign({ address: "GADDRESS123" }, secret, {
        algorithm: "HS256",
      });

      expect(auth.isTokenExpired(noExp)).toBe(true);
    });

    it("returns false for a token that has not yet expired", () => {
      const token = auth.generateToken("GADDRESS123");

      expect(auth.isTokenExpired(token)).toBe(false);
    });

    it("returns true and logs when the expiry check itself throws", () => {
      vi.spyOn(auth, "decodeToken").mockImplementation(() => {
        throw new Error("unexpected");
      });

      expect(auth.isTokenExpired("anything")).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        "Error checking token expiry:",
        expect.any(Error),
      );
    });
  });

  describe("getTokenExpiry", () => {
    it("returns null when the token has no exp claim", () => {
      const noExp = jwt.sign({ address: "GADDRESS123" }, secret, {
        algorithm: "HS256",
      });

      expect(auth.getTokenExpiry(noExp)).toBeNull();
    });

    it("returns null and logs when the expiry lookup throws", () => {
      vi.spyOn(auth, "decodeToken").mockImplementation(() => {
        throw new Error("unexpected");
      });

      expect(auth.getTokenExpiry("anything")).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "Error getting token expiry:",
        expect.any(Error),
      );
    });
  });
});
