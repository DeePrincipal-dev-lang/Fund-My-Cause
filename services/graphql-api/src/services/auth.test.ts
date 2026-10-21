/**
 * Unit tests for AuthService.
 *
 * Organized by behavior (token validation, expiry, role checks, etc.) rather than
 * by implementation detail. This merges auth.bugfix.test.ts, auth.preservation.test.ts,
 * and the original auth.test.ts into one coherent suite.
 *
 * Sections:
 * 1. Token validation — constructor security, JWT_SECRET requirements
 * 2. Token generation and verification round-trip
 * 3. Token expiry handling
 * 4. Header extraction and parsing
 * 5. Token inspection and mutation
 * 6. Message signing for authentication flows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { AuthService } from "./auth.js";

describe("AuthService", () => {
  const secret = "test-secret-key-32-chars-minimum!";
  const otherSecret = "different-secret-32-chars-minimum";
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(secret, "24h");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Token Validation — Constructor Security and JWT_SECRET Requirements
  // ──────────────────────────────────────────────────────────────────────────

  describe("Token validation: constructor security", () => {
    describe("rejects insecure JWT_SECRET values at startup", () => {
      it("should reject undefined JWT_SECRET", () => {
        expect(() => {
          new AuthService(undefined as any);
        }).toThrow(/JWT_SECRET/);
      });

      it("should reject empty JWT_SECRET", () => {
        expect(() => {
          new AuthService("");
        }).toThrow(/JWT_SECRET/);
      });

      it("should reject whitespace-only JWT_SECRET", () => {
        expect(() => {
          new AuthService("   ");
        }).toThrow(/JWT_SECRET/);
      });

      it("should reject JWT_SECRET shorter than 32 characters", () => {
        expect(() => {
          new AuthService("short");
        }).toThrow(/32/);
      });

      it("should reject JWT_SECRET with exactly 31 characters (boundary test)", () => {
        const secret31 = "a".repeat(31);
        expect(() => {
          new AuthService(secret31);
        }).toThrow(/32/);
      });

      it("should reject known default JWT_SECRET values", () => {
        const KNOWN_DEFAULTS = [
          "your-secret-key",
          "your-secret-key-change-in-production",
          "dev-secret-key-change-in-production",
        ];

        for (const defaultValue of KNOWN_DEFAULTS) {
          expect(() => {
            new AuthService(defaultValue);
          }).toThrow(/default|example/i);
        }
      });

      it("should reject ALL insecure secrets (property-based test)", () => {
        const insecureSecrets = [
          undefined,
          "",
          "   ",
          "short",
          "a".repeat(31),
          "your-secret-key",
          "your-secret-key-change-in-production",
          "dev-secret-key-change-in-production",
        ];

        for (const insecureSecret of insecureSecrets) {
          expect(() => {
            new AuthService(insecureSecret as any);
          }).toThrow();
        }
      });
    });

    describe("accepts valid JWT_SECRET (32+ characters, not default)", () => {
      it("should accept exactly 32 characters", () => {
        expect(() => {
          new AuthService("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6");
        }).not.toThrow();
      });

      it("should accept more than 32 characters", () => {
        expect(() => {
          new AuthService("very-long-secret-key-for-testing-purposes-12345678");
        }).not.toThrow();
      });

      it("should accept 64 characters (common for production)", () => {
        expect(() => {
          new AuthService(
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          );
        }).not.toThrow();
      });

      it("should accept secrets with special characters", () => {
        expect(() => {
          new AuthService("my-$ecret-K3y!@#$%^&*()-_+={}[]|:;<>?,./~`");
        }).not.toThrow();
      });

      it("should accept 100+ character secrets", () => {
        expect(() => {
          new AuthService("a".repeat(100));
        }).not.toThrow();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Token Generation and Verification Round-Trip
  // ──────────────────────────────────────────────────────────────────────────

  describe("Token generation and verification: round-trip", () => {
    it("should generate tokens with address and iat claims", () => {
      const token = auth.generateToken("GADDRESS123");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT format

      const decoded = jwt.decode(token) as any;
      expect(decoded).not.toBeNull();
      expect(decoded.address).toBe("GADDRESS123");
      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe("number");
    });

    it("should verify tokens generated with the same secret", () => {
      const token = auth.generateToken("GADDRESS456");
      const verified = auth.verifyToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.address).toBe("GADDRESS456");
      expect(typeof verified?.iat).toBe("number");
    });

    it("should use HS256 algorithm for all tokens", () => {
      const token = auth.generateToken("GADDRESSHS256TEST");

      const decoded = jwt.decode(token, { complete: true }) as any;
      expect(decoded).not.toBeNull();
      expect(decoded.header.alg).toBe("HS256");

      const verified = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
      expect(verified.address).toBe("GADDRESSHS256TEST");
    });

    it("should sign with the configured secret", () => {
      const token = auth.generateToken("GADDRESS123");
      const decodedWithRealSecret = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as any;
      expect(decodedWithRealSecret.address).toBe("GADDRESS123");

      expect(() =>
        jwt.verify(token, "wrong-secret", { algorithms: ["HS256"] }),
      ).toThrow();
    });

    it("should reject tokens verified against a different secret", () => {
      const token = auth.generateToken("GADDRESS123");
      const otherAuth = new AuthService(otherSecret, "24h");

      expect(otherAuth.verifyToken(token)).toBeNull();
    });

    it("should return null for malformed tokens (not throw)", () => {
      expect(auth.verifyToken("not-a-real-token")).toBeNull();
      expect(auth.verifyToken("")).toBeNull();
      expect(auth.verifyToken("invalid.token")).toBeNull();
    });

    it("should support multiple addresses without collision", () => {
      const addresses = [
        "GADDRESS001",
        "GADDRESS002",
        "GADDRESS003",
        "STELLAR_ADDRESS_LONG_FORMAT_TEST",
        "A",
      ];

      const tokens = addresses.map((addr) => auth.generateToken(addr));

      // Each address produces a different token
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(addresses.length);

      // Each token verifies back to its original address
      for (let i = 0; i < addresses.length; i++) {
        const verified = auth.verifyToken(tokens[i]);
        expect(verified?.address).toBe(addresses[i]);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Token Expiry Handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("Token expiry: lifecycle and inspection", () => {
    it("should respect token expiry settings", () => {
      const authService = new AuthService(secret, "24h");
      const token = authService.generateToken("GADDRESSEXPIRYTEST");
      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe("number");
    });

    it("should report fresh tokens as not expired", () => {
      const token = auth.generateToken("GADDRESS123");
      expect(auth.isTokenExpired(token)).toBe(false);
    });

    it("should report expired tokens as expired", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.isTokenExpired(token)).toBe(true);
          resolve();
        }, 1100);
      });
    });

    it("should report malformed tokens as expired (graceful degradation)", () => {
      expect(auth.isTokenExpired("garbage")).toBe(true);
      expect(auth.isTokenExpired("")).toBe(true);
    });

    it("should reject an expired token during verification", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.verifyToken(token)).toBeNull();
          resolve();
        }, 1100);
      });
    });

    it("should return the token expiry as a Date object", () => {
      const token = auth.generateToken("GADDRESS123");
      const decoded = jwt.decode(token) as any;

      const expiry = auth.getTokenExpiry(token);

      expect(expiry).not.toBeNull();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry?.getTime()).toBe(decoded.exp * 1000);
    });

    it("should return null for expiry of an undecodable token", () => {
      expect(auth.getTokenExpiry("garbage")).toBeNull();
      expect(auth.getTokenExpiry("")).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Header Extraction and Parsing
  // ──────────────────────────────────────────────────────────────────────────

  describe("Header extraction and parsing", () => {
    it("should extract the token from a well-formed Bearer header", () => {
      expect(auth.extractTokenFromHeader("Bearer abc.def.ghi")).toBe(
        "abc.def.ghi",
      );
    });

    it("should return null when header is missing", () => {
      expect(auth.extractTokenFromHeader(undefined)).toBeNull();
    });

    it("should return null when authorization scheme is not Bearer", () => {
      expect(auth.extractTokenFromHeader("Basic abc.def.ghi")).toBeNull();
      expect(auth.extractTokenFromHeader("Bearer ")).toBeNull();
    });

    it("should return null when header has wrong number of parts", () => {
      expect(auth.extractTokenFromHeader("Bearer")).toBeNull();
      expect(auth.extractTokenFromHeader("Bearer a b")).toBeNull();
      expect(auth.extractTokenFromHeader("Bearer a b c")).toBeNull();
    });

    it("should be case-sensitive for Bearer scheme", () => {
      // Standard Bearer scheme is case-sensitive per RFC 6750
      expect(auth.extractTokenFromHeader("bearer abc.def.ghi")).toBeNull();
      expect(auth.extractTokenFromHeader("BEARER abc.def.ghi")).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Token Inspection and Mutation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Token inspection and mutation", () => {
    it("should decode tokens without verifying the signature", () => {
      const token = auth.generateToken("GADDRESS123");
      const otherAuth = new AuthService(otherSecret, "24h");
      const decoded = otherAuth.decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded.address).toBe("GADDRESS123");
    });

    it("should return null for undecodable tokens", () => {
      expect(auth.decodeToken("not-a-token")).toBeNull();
      expect(auth.decodeToken("")).toBeNull();
      expect(auth.decodeToken("garbage")).toBeNull();
    });

    it("should handle tokens with special characters in address", () => {
      const specialAddresses = [
        "GADDRESS_WITH_UNDERSCORE",
        "GADDRESS-WITH-DASH",
        "GADDRESS.WITH.DOT",
        "GADDRESS$WITH$SPECIAL",
      ];

      for (const addr of specialAddresses) {
        const token = auth.generateToken(addr);
        const verified = auth.verifyToken(token);
        expect(verified?.address).toBe(addr);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Message Signing for Authentication Flows
  // ──────────────────────────────────────────────────────────────────────────

  describe("Message signing for authentication flows", () => {
    it("should create a signature message that embeds address and nonce", () => {
      const message = auth.createSignatureMessage("GADDRESS123", "nonce-1");

      expect(message).toContain("GADDRESS123");
      expect(message).toContain("nonce-1");
      expect(message).toContain("Sign this message to authenticate with Fund My Cause");
    });

    it("should include the nonce in every signature message", () => {
      const nonces = ["nonce-1", "nonce-2", "different-nonce-xyz"];

      for (const nonce of nonces) {
        const message = auth.createSignatureMessage("GADDRESS123", nonce);
        expect(message).toContain(nonce);
      }
    });

    it("should include the address in every signature message", () => {
      const addresses = [
        "GADDRESS001",
        "GADDRESS002",
        "STELLAR_ADDRESS_LONG_FORMAT_TEST",
      ];

      for (const addr of addresses) {
        const message = auth.createSignatureMessage(addr, "nonce-1");
        expect(message).toContain(addr);
      }
    });

    it("should produce different messages for different addresses", () => {
      const msg1 = auth.createSignatureMessage("GADDRESS001", "nonce-1");
      const msg2 = auth.createSignatureMessage("GADDRESS002", "nonce-1");

      expect(msg1).not.toBe(msg2);
    });

    it("should produce different messages for different nonces", () => {
      const msg1 = auth.createSignatureMessage("GADDRESS001", "nonce-1");
      const msg2 = auth.createSignatureMessage("GADDRESS001", "nonce-2");

      expect(msg1).not.toBe(msg2);
    });
  });
});
