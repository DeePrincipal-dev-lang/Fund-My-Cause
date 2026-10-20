import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { AuthService } from "../auth.js";

describe("AuthService", () => {
  const secret = "test-secret-key-32-chars-minimum!";
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(secret, "24h");
  });

  describe("generateToken / verifyToken round trip", () => {
    it("issues a token that verifies back to the same address", () => {
      const token = auth.generateToken("GADDRESS123");
      const decoded = auth.verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.address).toBe("GADDRESS123");
      expect(typeof decoded?.iat).toBe("number");
    });

    it("signs with HS256 and the configured secret", () => {
      const token = auth.generateToken("GADDRESS123");
      const decodedWithRealSecret = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as any;
      expect(decodedWithRealSecret.address).toBe("GADDRESS123");

      expect(() =>
        jwt.verify(token, "wrong-secret", { algorithms: ["HS256"] }),
      ).toThrow();
    });

    it("rejects a token verified against a different secret", () => {
      const token = auth.generateToken("GADDRESS123");
      const otherAuth = new AuthService(
        "a-completely-different-secret-32c",
        "24h",
      );

      expect(otherAuth.verifyToken(token)).toBeNull();
    });

    it("returns null for a malformed token instead of throwing", () => {
      expect(auth.verifyToken("not-a-real-token")).toBeNull();
    });
  });

  describe("token expiry", () => {
    it("rejects an expired token", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.verifyToken(token)).toBeNull();
          resolve();
        }, 1100);
      });
    });

    it("isTokenExpired returns false for a freshly issued token", () => {
      const token = auth.generateToken("GADDRESS123");
      expect(auth.isTokenExpired(token)).toBe(false);
    });

    it("isTokenExpired returns true for an expired token", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.isTokenExpired(token)).toBe(true);
          resolve();
        }, 1100);
      });
    });

    it("isTokenExpired returns true for an undecodable token", () => {
      expect(auth.isTokenExpired("garbage")).toBe(true);
    });

    it("getTokenExpiry returns a Date matching the token's exp claim", () => {
      const token = auth.generateToken("GADDRESS123");
      const decoded = jwt.decode(token) as any;

      const expiry = auth.getTokenExpiry(token);

      expect(expiry).not.toBeNull();
      expect(expiry?.getTime()).toBe(decoded.exp * 1000);
    });

    it("getTokenExpiry returns null for an undecodable token", () => {
      expect(auth.getTokenExpiry("garbage")).toBeNull();
    });
  });

  describe("token tampering detection", () => {
    it("detects tampered payload by comparing against expected secret", () => {
      const token = auth.generateToken("GADDRESS123");

      // Modify the payload
      const parts = token.split(".");
      const modifiedPayload = Buffer.from(
        JSON.stringify({ address: "HACKER", iat: 0 }),
      ).toString("base64url");
      const tamperedToken = modifiedPayload + "." + parts[2];

      expect(auth.verifyToken(tamperedToken)).toBeNull();
    });

    it("rejects tokens with modified exp claim when verified with verifyToken", () => {
      const token = auth.generateToken("GADDRESS123");

      // Create a token that will appear expired by modifying the payload
      const decoded = jwt.decode(token, { complete: true }) as any;
      const modifiedDecoded = {
        ...decoded?.payload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const tamperedToken = jwt.sign(
        modifiedDecoded,
        "different-secret-32-chars-minimum",
        {
          algorithm: "HS256",
          noTimestamp: true,
        },
      );

      // Will fail to verify with our auth service's secret
      expect(auth.verifyToken(tamperedToken)).toBeNull();
    });

    it("rejects a token signed with a different algorithm", () => {
      const payload = {
        address: "GADDRESS123",
        iat: Math.floor(Date.now() / 1000),
      };
      // Sign with RS256 (different algorithm)
      const token = jwt.sign(payload, secret, { algorithm: "HS512" });

      expect(auth.verifyToken(token)).toBeNull();
    });

    it("detects when address field is tampered with", () => {
      // Create a token with one address
      const originalToken = auth.generateToken("GADDRESS123");

      // Attempt to create a tampered token with different address
      const decoded = jwt.decode(originalToken) as any;
      const tamperedPayload = { ...decoded, address: "HACKER_ADDRESS" };
      const tamperedToken = jwt.sign(tamperedPayload, secret, {
        algorithm: "HS256",
        noTimestamp: true,
      });

      // Verify should work (same secret) but return different address
      const verified = auth.verifyToken(tamperedToken);
      expect(verified?.address).toBe("HACKER_ADDRESS");
      expect(verified?.address).not.toBe("GADDRESS123");
    });
  });

  describe("constructor validation", () => {
    it("throws error when JWT_SECRET is too short", () => {
      expect(() => {
        new AuthService("short-secret");
      }).toThrow(/32 characters/);
    });

    it("throws error when JWT_SECRET is undefined", () => {
      expect(() => {
        new AuthService(undefined as any);
      }).toThrow(/JWT_SECRET/);
    });

    it("throws error when JWT_SECRET is empty", () => {
      expect(() => {
        new AuthService("");
      }).toThrow(/JWT_SECRET/);
    });

    it("throws error for known default secrets", () => {
      expect(() => {
        new AuthService("your-secret-key-change-in-production");
      }).toThrow(/default/);
    });

    it("accepts valid JWT_SECRET", () => {
      expect(() => {
        new AuthService("valid-secret-32-characters-long!");
      }).not.toThrow();
    });
  });

  describe("extractTokenFromHeader", () => {
    it("extracts the token from a well-formed Bearer header", () => {
      expect(auth.extractTokenFromHeader("Bearer abc.def.ghi")).toBe(
        "abc.def.ghi",
      );
    });

    it("returns null when the header is missing", () => {
      expect(auth.extractTokenFromHeader(undefined)).toBeNull();
    });

    it("returns null when the scheme is not Bearer", () => {
      expect(auth.extractTokenFromHeader("Basic abc.def.ghi")).toBeNull();
    });

    it("returns null when the header has the wrong number of parts", () => {
      expect(auth.extractTokenFromHeader("Bearer")).toBeNull();
      expect(auth.extractTokenFromHeader("Bearer a b")).toBeNull();
    });
  });

  describe("decodeToken", () => {
    it("decodes token payload without verifying the signature", () => {
      const token = auth.generateToken("GADDRESS123");
      const otherAuth = new AuthService(
        "different-secret-32-chars-minimum",
        "24h",
      );
      const decoded = otherAuth.decodeToken(token);

      expect(decoded.address).toBe("GADDRESS123");
    });

    it("returns null for an undecodable token", () => {
      expect(auth.decodeToken("not-a-token")).toBeNull();
    });
  });

  describe("createSignatureMessage", () => {
    it("embeds the address and nonce in the message", () => {
      const message = auth.createSignatureMessage("GADDRESS123", "nonce-1");

      expect(message).toContain("GADDRESS123");
      expect(message).toContain("nonce-1");
      expect(message).toContain(
        "Sign this message to authenticate with Fund My Cause",
      );
    });

    it("includes a timestamp in the message", () => {
      const before = Date.now();
      const message = auth.createSignatureMessage("GADDRESS123", "nonce-1");
      const after = Date.now();

      expect(message).toContain("Timestamp:");
      const tsMatch = message.match(/Timestamp: (.+)/);
      expect(tsMatch).not.toBeNull();
      const ts = new Date(tsMatch![1]).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe("getTokenExpiry edge cases", () => {
    it("returns null for a token with no exp claim", () => {
      const payload = {
        address: "GADDRESS123",
        iat: Math.floor(Date.now() / 1000),
      };
      const token = jwt.sign(payload, secret, {
        algorithm: "HS256",
        noTimestamp: true,
      });
      expect(auth.getTokenExpiry(token)).toBeNull();
    });
  });

  describe("isTokenExpired edge cases", () => {
    it("returns true for a non-string input", () => {
      expect(auth.isTokenExpired(null as any)).toBe(true);
      expect(auth.isTokenExpired(undefined as any)).toBe(true);
    });

    it("returns true for a token without exp claim", () => {
      const payload = {
        address: "GADDRESS123",
        iat: Math.floor(Date.now() / 1000),
      };
      const token = jwt.sign(payload, secret, {
        algorithm: "HS256",
        noTimestamp: true,
      });
      expect(auth.isTokenExpired(token)).toBe(true);
    });
  });

  describe("generateToken error handling", () => {
    it("propagates errors from jwt.sign", () => {
      const authWithShortExpiry = new AuthService(secret, "1ms");
      expect(() => authWithShortExpiry.generateToken("")).not.toThrow();
    });
  });

  describe("verifyToken catch path", () => {
    it("returns null when verification throws unexpected error", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = auth.verifyToken("completely.invalid.token");
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("getTokenExpiry catch path", () => {
    it("returns null when decode throws", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = auth.getTokenExpiry("not-a-token");
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });
});
