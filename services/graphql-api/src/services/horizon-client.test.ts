import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HorizonClient,
  getOrCreateHorizonClient,
  resetHorizonClient,
} from "./horizon-client";
import { HorizonCircuitBreaker } from "./horizon-circuit-breaker";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("HorizonClient", () => {
  let client: HorizonClient;
  const horizonUrl = "https://horizon.stellar.org";

  beforeEach(() => {
    resetHorizonClient();
    mockFetch.mockReset();
    client = new HorizonClient({ horizonUrl });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with Horizon URL", () => {
      expect(client).toBeDefined();
    });

    it("should remove trailing slash from URL", () => {
      const clientWithSlash = new HorizonClient({
        horizonUrl: "https://horizon.stellar.org/",
      });
      expect(clientWithSlash).toBeDefined();
    });

    it("should initialize circuit breaker", () => {
      expect(client.getCircuitState()).toBe("CLOSED");
    });
  });

  describe("getAccount", () => {
    it("should fetch account details successfully", async () => {
      const accountData = {
        id: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        balances: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => accountData,
      });

      const result = await client.getAccount(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(accountData);
    });

    it("should handle account not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ detail: "Account not found" }),
      });

      const result = await client.getAccount("INVALID_ACCOUNT");

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.getAccount(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("getAccountTransactions", () => {
    it("should fetch transactions with parameters", async () => {
      const txData = {
        _embedded: {
          records: [
            {
              id: "tx123",
              hash: "hash123",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => txData,
      });

      const result = await client.getAccountTransactions(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        { limit: 10, order: "desc" }
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(txData);

      // Check that query parameters were included
      const callUrl = mockFetch.mock.calls[0]?.[0];
      expect(callUrl).toContain("limit=10");
      expect(callUrl).toContain("order=desc");
    });

    it("should work without parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ _embedded: { records: [] } }),
      });

      const result = await client.getAccountTransactions(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(true);
    });
  });

  describe("getAccountOperations", () => {
    it("should fetch operations successfully", async () => {
      const opsData = {
        _embedded: {
          records: [
            {
              id: "123",
              type: "payment",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => opsData,
      });

      const result = await client.getAccountOperations(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(opsData);
    });
  });

  describe("getTransaction", () => {
    it("should fetch transaction details", async () => {
      const txData = {
        id: "tx123",
        hash: "abc123",
        type_i: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => txData,
      });

      const result = await client.getTransaction("abc123");

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(txData);
    });
  });

  describe("getOperation", () => {
    it("should fetch operation details", async () => {
      const opData = {
        id: "op123",
        type: "payment",
        amount: "100",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => opData,
      });

      const result = await client.getOperation("op123");

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(opData);
    });
  });

  describe("submitTransaction", () => {
    it("should submit transaction successfully", async () => {
      const submitResponse = {
        id: "tx123",
        hash: "abc123",
        successful: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => submitResponse,
      });

      const xdr = "AAAAAgAAAA..."; // Simplified XDR
      const result = await client.submitTransaction(xdr);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(submitResponse);

      // Verify POST method was used
      expect(mockFetch.mock.calls[0]?.[1]?.method).toBe("POST");
    });

    it("should handle submission errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          detail: "Invalid transaction",
        }),
      });

      const result = await client.submitTransaction("invalid-xdr");

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getRoot", () => {
    it("should fetch server status", async () => {
      const rootData = {
        horizon_version: "21.0.0",
        core_version: "21.0.0",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rootData,
      });

      const result = await client.getRoot();

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(rootData);
    });
  });

  describe("circuit breaker integration", () => {
    it("should open circuit breaker after failures", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));

      // Trigger failures to open the circuit
      for (let i = 0; i < 5; i++) {
        await client.getAccount("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
      }

      expect(client.getCircuitState()).toBe("OPEN");
    });

    it("should reject calls when circuit is open", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await client.getAccount("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
      }

      // Now circuit should be open and calls should be rejected immediately
      const result = await client.getAccount("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(5); // No additional calls made
    });
  });

  describe("getOrCreateHorizonClient", () => {
    beforeEach(() => {
      resetHorizonClient();
    });

    it("should create client on first call", () => {
      const client1 = getOrCreateHorizonClient({ horizonUrl });

      expect(client1).toBeDefined();
      expect(client1).toBeInstanceOf(HorizonClient);
    });

    it("should return same instance on subsequent calls", () => {
      const client1 = getOrCreateHorizonClient({ horizonUrl });
      const client2 = getOrCreateHorizonClient({ horizonUrl });

      expect(client1).toBe(client2);
    });

    it("should create new instance after reset", () => {
      const client1 = getOrCreateHorizonClient({ horizonUrl });
      resetHorizonClient();
      const client2 = getOrCreateHorizonClient({ horizonUrl });

      expect(client1).not.toBe(client2);
    });
  });

  describe("error handling", () => {
    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Request timeout"));

      const result = await client.getAccount(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should handle JSON parsing errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const result = await client.getAccount(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    it("should handle server errors (5xx)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({ detail: "Service temporarily unavailable" }),
      });

      const result = await client.getAccount(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("503");
    });
  });

  describe("URL construction", () => {
    it("should construct correct paths", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.getAccount("TEST_ACCOUNT");

      const callUrl = mockFetch.mock.calls[0]?.[0];
      expect(callUrl).toContain("/accounts/TEST_ACCOUNT");
    });

    it("should use https scheme", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.getRoot();

      const callUrl = mockFetch.mock.calls[0]?.[0];
      expect(callUrl).toMatch(/^https:\/\//);
    });
  });
});
