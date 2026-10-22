import { apiClient, ApiError } from "./api-client";

global.fetch = jest.fn();

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("error handling", () => {
    it("throws ApiError on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: "Not found" }),
      });

      await expect(apiClient.get("/nonexistent")).rejects.toThrow(ApiError);
    });

    it("includes status code in ApiError", async () => {
      const errorStatus = 500;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: errorStatus,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: "Internal server error" }),
      });

      try {
        await apiClient.get("/error");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(errorStatus);
      }
    });

    it("extracts message from error response", async () => {
      const errorMessage = "Resource validation failed";
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: errorMessage }),
      });

      try {
        await apiClient.get("/invalid");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as Error).message).toBe(errorMessage);
      }
    });

    it("handles network errors", async () => {
      const networkError = new Error("Network timeout");
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      try {
        await apiClient.get("/timeout");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(0);
      }
    });

    it("handles malformed JSON in error response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.reject(new Error("Malformed JSON")),
        text: () => Promise.resolve("error"),
      });

      await expect(apiClient.get("/error")).rejects.toThrow(ApiError);
    });

    it("provides fallback error message for non-JSON responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        headers: new Headers({ "content-type": "text/plain" }),
        json: () => Promise.reject(new Error("Not JSON")),
        text: () => Promise.resolve("Bad gateway"),
      });

      try {
        await apiClient.get("/gateway-error");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(502);
      }
    });
  });

  describe("GET requests", () => {
    it("makes GET request with correct path", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ data: "test" }),
      });

      await apiClient.get("/test");

      expect(global.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns parsed JSON response", async () => {
      const testData = { id: 1, name: "Test" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const result = await apiClient.get("/test");
      expect(result).toEqual(testData);
    });
  });

  describe("POST requests", () => {
    it("makes POST request with JSON body", async () => {
      const postData = { name: "New item" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ id: 1, ...postData }),
      });

      await apiClient.post("/items", postData);

      expect(global.fetch).toHaveBeenCalledWith(
        "/items",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("handles FormData in POST requests", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ success: true }),
      });

      await apiClient.post("/upload", formData);

      expect(global.fetch).toHaveBeenCalledWith(
        "/upload",
        expect.objectContaining({
          method: "POST",
          body: formData,
        }),
      );
    });
  });

  describe("PUT requests", () => {
    it("makes PUT request with JSON body", async () => {
      const updateData = { name: "Updated" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(updateData),
      });

      await apiClient.put("/items/1", updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        "/items/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updateData),
        }),
      );
    });
  });

  describe("DELETE requests", () => {
    it("makes DELETE request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      await apiClient.delete("/items/1");

      expect(global.fetch).toHaveBeenCalledWith(
        "/items/1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("returns undefined for 204 No Content", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await apiClient.delete("/items/1");
      expect(result).toBeUndefined();
    });
  });

  describe("request options", () => {
    it("includes custom headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ data: "test" }),
      });

      await apiClient.get("/test", {
        headers: { "X-Custom": "value" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Custom": "value" }),
        }),
      );
    });

    it("includes auth header when provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ data: "test" }),
      });

      await apiClient.get("/protected", {
        authHeader: "Bearer token123",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/protected",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token123",
          }),
        }),
      );
    });
  });
});
