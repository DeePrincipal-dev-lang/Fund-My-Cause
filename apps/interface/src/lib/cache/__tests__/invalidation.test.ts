import {
  purgeCache,
  getSurrogateKeysForCampaign,
  getSurrogateKeysForUser,
  type CachePurgeOptions,
  type CachePurgeResult,
} from "../invalidation";

describe("cache invalidation utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSurrogateKeysForCampaign", () => {
    it("should return array of surrogate keys for campaign", () => {
      const contractId =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      const keys = getSurrogateKeysForCampaign(contractId);

      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toContain("campaigns");
      expect(keys).toContain(`campaign:${contractId}`);
    });

    it("should return consistent keys for same contract", () => {
      const contractId = "CTEST123";
      const keys1 = getSurrogateKeysForCampaign(contractId);
      const keys2 = getSurrogateKeysForCampaign(contractId);

      expect(keys1).toEqual(keys2);
    });

    it("should return different keys for different contracts", () => {
      const contract1 = "CONTRACT1";
      const contract2 = "CONTRACT2";

      const keys1 = getSurrogateKeysForCampaign(contract1);
      const keys2 = getSurrogateKeysForCampaign(contract2);

      expect(keys1).not.toEqual(keys2);
      expect(keys1).toContain(`campaign:${contract1}`);
      expect(keys2).toContain(`campaign:${contract2}`);
    });

    it("should always include base campaigns key", () => {
      const keys1 = getSurrogateKeysForCampaign("CONTRACT1");
      const keys2 = getSurrogateKeysForCampaign("CONTRACT2");

      expect(keys1).toContain("campaigns");
      expect(keys2).toContain("campaigns");
    });
  });

  describe("getSurrogateKeysForUser", () => {
    it("should return array of surrogate keys for user", () => {
      const address = "GUSER123456789";
      const keys = getSurrogateKeysForUser(address);

      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toContain("campaigns");
      expect(keys).toContain(`user:${address}`);
    });

    it("should return consistent keys for same address", () => {
      const address = "GUSER123";
      const keys1 = getSurrogateKeysForUser(address);
      const keys2 = getSurrogateKeysForUser(address);

      expect(keys1).toEqual(keys2);
    });

    it("should return different keys for different addresses", () => {
      const address1 = "GUSER1";
      const address2 = "GUSER2";

      const keys1 = getSurrogateKeysForUser(address1);
      const keys2 = getSurrogateKeysForUser(address2);

      expect(keys1).not.toEqual(keys2);
      expect(keys1).toContain(`user:${address1}`);
      expect(keys2).toContain(`user:${address2}`);
    });

    it("should always include base campaigns key", () => {
      const keys1 = getSurrogateKeysForUser("GUSER1");
      const keys2 = getSurrogateKeysForUser("GUSER2");

      expect(keys1).toContain("campaigns");
      expect(keys2).toContain("campaigns");
    });
  });

  describe("purgeCache", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should send POST request with correct headers", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          purged: ["key1", "key2"],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1", "key2"],
      };

      await purgeCache(options);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://cache.example.com/api/cache",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should include api key in headers when provided", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          purged: [],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        apiKey: "secret-key-123",
        surrogateKeys: ["key1"],
      };

      await purgeCache(options);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "secret-key-123",
          }),
        }),
      );
    });

    it("should send surrogate keys in request body", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          purged: ["key1", "key2"],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const surrogateKeys = ["key1", "key2", "key3"];
      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys,
      };

      await purgeCache(options);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.surrogateKeys).toEqual(surrogateKeys);
    });

    it("should include soft flag in body when provided", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          purged: [],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1"],
        soft: true,
      };

      await purgeCache(options);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.soft).toBe(true);
    });

    it("should return parsed JSON response on success", async () => {
      const expectedResult: CachePurgeResult = {
        success: true,
        purged: ["key1", "key2"],
        timestamp: "2024-01-01T00:00:00Z",
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(expectedResult),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1", "key2"],
      };

      const result = await purgeCache(options);

      expect(result).toEqual(expectedResult);
      expect(result.success).toBe(true);
      expect(result.purged).toEqual(["key1", "key2"]);
    });

    it("should throw error on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized"),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1"],
      };

      await expect(purgeCache(options)).rejects.toThrow(
        /Cache purge failed \(401\)/,
      );
    });

    it("should throw error with response text on failure", async () => {
      const errorText = "Invalid API key";
      const mockResponse = {
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue(errorText),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        apiKey: "invalid-key",
        surrogateKeys: ["key1"],
      };

      await expect(purgeCache(options)).rejects.toThrow(errorText);
    });

    it("should construct correct endpoint URL", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          purged: [],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const baseEndpoint = "https://cache.example.com";
      const options: CachePurgeOptions = {
        endpoint: baseEndpoint,
        surrogateKeys: ["key1"],
      };

      await purgeCache(options);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseEndpoint}/api/cache`,
        expect.any(Object),
      );
    });

    it("should handle response with failed purges", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: false,
          purged: ["key1"],
          failed: [{ key: "key2", reason: "Invalid format" }],
          timestamp: new Date().toISOString(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1", "key2"],
      };

      const result = await purgeCache(options);

      expect(result.purged).toContain("key1");
      expect(result.failed).toBeDefined();
      expect(result.failed?.[0].key).toBe("key2");
    });
  });

  describe("type definitions", () => {
    it("CachePurgeOptions requires endpoint and surrogateKeys", () => {
      const options: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1"],
      };

      expect(options).toBeDefined();
      expect("endpoint" in options).toBe(true);
      expect("surrogateKeys" in options).toBe(true);
    });

    it("CachePurgeOptions apiKey is optional", () => {
      const withoutKey: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1"],
      };

      const withKey: CachePurgeOptions = {
        endpoint: "https://cache.example.com",
        surrogateKeys: ["key1"],
        apiKey: "key",
      };

      expect(withoutKey).toBeDefined();
      expect(withKey).toBeDefined();
    });

    it("CachePurgeResult has required fields", () => {
      const result: CachePurgeResult = {
        success: true,
        purged: ["key1"],
        timestamp: new Date().toISOString(),
      };

      expect(result).toBeDefined();
      expect("success" in result).toBe(true);
      expect("purged" in result).toBe(true);
      expect("timestamp" in result).toBe(true);
    });
  });
});
