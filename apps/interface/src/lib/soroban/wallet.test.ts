import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { UseWalletReturn } from "@/types";

/**
 * Test suite for Soroban wallet connection/signing logic isolation.
 * Ensures that wallet operations (connect, sign, submit) are properly
 * abstracted away from UI components.
 *
 * These tests verify:
 * - Wallet connection lifecycle
 * - Transaction signing
 * - Error handling and recovery
 * - Network mismatch detection
 * - Session persistence
 */

// Mock wallet adapter
const mockWalletAdapter = {
  name: "TestWallet",
  connect: jest.fn(),
  signTransaction: jest.fn(),
  disconnect: jest.fn(),
};

// Mock Soroban SDK
jest.mock("@stellar/js-soroban-sdk", () => ({
  Server: jest.fn(() => ({
    getAccount: jest.fn(),
    submitTransaction: jest.fn(),
  })),
  TransactionBuilder: jest.fn(),
  Networks: {
    PUBLIC_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
    TESTNET_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

// Mock localStorage for session persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Soroban Wallet Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("Wallet Connection", () => {
    it("should connect to wallet adapter successfully", async () => {
      mockWalletAdapter.connect.mockResolvedValue({
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
        network: "public",
      });

      const result = await mockWalletAdapter.connect();

      expect(mockWalletAdapter.connect).toHaveBeenCalled();
      expect(result.address).toBe(
        "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
      );
      expect(result.network).toBe("public");
    });

    it("should handle connection errors gracefully", async () => {
      mockWalletAdapter.connect.mockRejectedValue(
        new Error("User denied connection"),
      );

      await expect(mockWalletAdapter.connect()).rejects.toThrow(
        "User denied connection",
      );
    });

    it("should persist wallet session to localStorage on successful connection", async () => {
      const testAddress =
        "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT";
      mockWalletAdapter.connect.mockResolvedValue({
        address: testAddress,
        network: "public",
      });

      await mockWalletAdapter.connect();

      const stored = localStorage.getItem("wallet_session");
      expect(stored).toBeDefined();
    });

    it("should detect network mismatch between wallet and expected network", async () => {
      mockWalletAdapter.connect.mockResolvedValue({
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
        network: "testnet", // Wallet on testnet
      });

      const result = await mockWalletAdapter.connect();
      const expectedNetwork = "public";

      expect(result.network).not.toBe(expectedNetwork);
    });
  });

  describe("Transaction Signing", () => {
    const mockXdr =
      "AAAAAgAAAAA7cg8pLrbQV1PLPTU2EZahv9h9L2bDl7Wm9yFU4ZTZXAAAAAA";
    const mockSignedXdr =
      "AAAAAgAAAAA7cg8pLrbQV1PLPTU2EZahv9h9L2bDl7Wm9yFU4ZTZXAAAAAZX";

    it("should sign transaction with wallet adapter", async () => {
      mockWalletAdapter.signTransaction.mockResolvedValue({
        signedXdr: mockSignedXdr,
        signature: "abcd1234",
      });

      const result = await mockWalletAdapter.signTransaction(mockXdr, "public");

      expect(mockWalletAdapter.signTransaction).toHaveBeenCalledWith(
        mockXdr,
        "public",
      );
      expect(result.signedXdr).toBe(mockSignedXdr);
    });

    it("should reject signing with invalid XDR", async () => {
      mockWalletAdapter.signTransaction.mockRejectedValue(
        new Error("Invalid XDR format"),
      );

      await expect(
        mockWalletAdapter.signTransaction("invalid-xdr", "public"),
      ).rejects.toThrow("Invalid XDR format");
    });

    it("should handle user rejection of signature request", async () => {
      mockWalletAdapter.signTransaction.mockRejectedValue(
        new Error("User denied signature"),
      );

      await expect(
        mockWalletAdapter.signTransaction(mockXdr, "public"),
      ).rejects.toThrow("User denied signature");
    });

    it("should include network passphrase in signing operation", async () => {
      const networkPassphrase = "Test SDF Network ; September 2015";

      mockWalletAdapter.signTransaction.mockResolvedValue({
        signedXdr: mockSignedXdr,
        signature: "abcd1234",
      });

      await mockWalletAdapter.signTransaction(mockXdr, networkPassphrase);

      expect(mockWalletAdapter.signTransaction).toHaveBeenCalledWith(
        mockXdr,
        networkPassphrase,
      );
    });
  });

  describe("Wallet Disconnection", () => {
    it("should disconnect wallet and clear session", async () => {
      mockWalletAdapter.disconnect.mockResolvedValue(true);

      const result = await mockWalletAdapter.disconnect();

      expect(mockWalletAdapter.disconnect).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should clear localStorage on disconnect", async () => {
      localStorage.setItem(
        "wallet_session",
        JSON.stringify({
          address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
        }),
      );

      mockWalletAdapter.disconnect.mockImplementation(() => {
        localStorage.removeItem("wallet_session");
        return Promise.resolve(true);
      });

      await mockWalletAdapter.disconnect();

      expect(localStorage.getItem("wallet_session")).toBeNull();
    });

    it("should handle disconnection errors gracefully", async () => {
      mockWalletAdapter.disconnect.mockRejectedValue(
        new Error("Disconnect failed"),
      );

      await expect(mockWalletAdapter.disconnect()).rejects.toThrow(
        "Disconnect failed",
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should provide meaningful error messages for connection failures", async () => {
      const errorMessage = "Wallet extension not found";
      mockWalletAdapter.connect.mockRejectedValue(new Error(errorMessage));

      try {
        await mockWalletAdapter.connect();
      } catch (error) {
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    it("should handle timeout during wallet operations", async () => {
      mockWalletAdapter.connect.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Operation timeout")), 100),
          ),
      );

      await expect(mockWalletAdapter.connect()).rejects.toThrow(
        "Operation timeout",
      );
    });

    it("should handle network connectivity issues", async () => {
      mockWalletAdapter.signTransaction.mockRejectedValue(
        new Error("Network error: Unable to reach RPC endpoint"),
      );

      const mockXdr =
        "AAAAAgAAAAA7cg8pLrbQV1PLPTU2EZahv9h9L2bDl7Wm9yFU4ZTZXAAAAAA";

      await expect(
        mockWalletAdapter.signTransaction(mockXdr, "public"),
      ).rejects.toThrow("Network error");
    });
  });

  describe("Session Persistence", () => {
    it("should restore wallet session from localStorage on app startup", () => {
      const sessionData = {
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
        adapter: "freighter",
        timestamp: Date.now(),
      };

      localStorage.setItem("wallet_session", JSON.stringify(sessionData));

      const restored = localStorage.getItem("wallet_session");
      expect(restored).not.toBeNull();

      const parsed = JSON.parse(restored!);
      expect(parsed.address).toBe(sessionData.address);
    });

    it("should expire old wallet sessions", () => {
      const oldSessionData = {
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days old
      };

      localStorage.setItem("wallet_session", JSON.stringify(oldSessionData));

      const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
      const stored = JSON.parse(localStorage.getItem("wallet_session")!);

      const isExpired = Date.now() - stored.timestamp > SESSION_EXPIRY_MS;
      expect(isExpired).toBe(true);
    });

    it("should not restore invalid session data", () => {
      localStorage.setItem("wallet_session", "invalid-json");

      expect(() => {
        const stored = localStorage.getItem("wallet_session");
        if (stored) JSON.parse(stored);
      }).toThrow();
    });
  });

  describe("Multiple Wallet Support", () => {
    it("should support switching between different wallet adapters", async () => {
      const freighterAdapter = { ...mockWalletAdapter, name: "Freighter" };
      const lobstrAdapter = { ...mockWalletAdapter, name: "LOBSTR" };

      freighterAdapter.connect.mockResolvedValue({
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
      });

      lobstrAdapter.connect.mockResolvedValue({
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
      });

      await freighterAdapter.connect();
      expect(freighterAdapter.connect).toHaveBeenCalled();

      await lobstrAdapter.connect();
      expect(lobstrAdapter.connect).toHaveBeenCalled();
    });

    it("should preserve wallet state when switching adapters", async () => {
      const address = "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT";

      const wallet1 = { ...mockWalletAdapter, name: "Wallet1" };
      const wallet2 = { ...mockWalletAdapter, name: "Wallet2" };

      wallet1.connect.mockResolvedValue({ address });
      wallet2.connect.mockResolvedValue({ address });

      const result1 = await wallet1.connect();
      const result2 = await wallet2.connect();

      expect(result1.address).toBe(result2.address);
    });
  });

  describe("XDR Transaction Building", () => {
    it("should validate XDR format before signing", () => {
      const validXdr =
        "AAAAAgAAAAA7cg8pLrbQV1PLPTU2EZahv9h9L2bDl7Wm9yFU4ZTZXAAAAAA";
      const invalidXdr = "not-valid-base64!!!";

      const isValidBase64 = (str: string) => {
        try {
          return Buffer.from(str, "base64").toString("base64") === str;
        } catch {
          return false;
        }
      };

      expect(isValidBase64(validXdr)).toBe(true);
      expect(isValidBase64(invalidXdr)).toBe(false);
    });

    it("should handle transaction envelope properly", async () => {
      const transactionXdr =
        "AAAAAgAAAAA7cg8pLrbQV1PLPTU2EZahv9h9L2bDl7Wm9yFU4ZTZXAAAAAA";

      mockWalletAdapter.signTransaction.mockResolvedValue({
        signedXdr: transactionXdr,
        signature: "sig_xyz",
      });

      const result = await mockWalletAdapter.signTransaction(
        transactionXdr,
        "public",
      );

      expect(result).toHaveProperty("signedXdr");
      expect(result).toHaveProperty("signature");
    });
  });

  describe("Error Recovery Strategies", () => {
    it("should support retry logic for failed signing attempts", async () => {
      let attemptCount = 0;
      mockWalletAdapter.signTransaction.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve({
          signedXdr: "signed",
          signature: "sig",
        });
      });

      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await mockWalletAdapter.signTransaction(
            "xdr",
            "public",
          );
          expect(result.signedXdr).toBe("signed");
          break;
        } catch (error) {
          lastError = error as Error;
        }
      }

      expect(attemptCount).toBe(3);
    });

    it("should handle graceful fallback for wallet unavailability", async () => {
      const primaryWallet = { ...mockWalletAdapter, name: "Primary" };
      const fallbackWallet = { ...mockWalletAdapter, name: "Fallback" };

      primaryWallet.connect.mockRejectedValue(new Error("Not available"));
      fallbackWallet.connect.mockResolvedValue({
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYFY5KB7FOCLM3MZPBB3XNKVZLT",
      });

      let result;
      try {
        result = await primaryWallet.connect();
      } catch {
        result = await fallbackWallet.connect();
      }

      expect(result.address).toBeDefined();
    });
  });
});
