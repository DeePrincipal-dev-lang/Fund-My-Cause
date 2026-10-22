/**
 * Typed wrapper around `fetch` for this app's own `/api/*` routes.
 *
 * Scope is intentionally narrow: it standardizes calls into our own Next.js
 * API routes (JSON in, JSON out, one error shape). External integrations
 * with their own auth/response contracts — the GraphQL SDK
 * (`@/lib/graphql/client`), Stellar Horizon, CoinGecko, Pinata, error-tracking
 * beacons — keep their dedicated clients rather than being forced through a
 * generic REST wrapper.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly info: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Wallet-auth header value, e.g. `Wallet <address>:<ts>:<sig>` (see `@/lib/walletAuth`). */
  authHeader?: string;
  next?: RequestInit["next"];
  cache?: RequestInit["cache"];
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) return await response.json();
    return await response.text();
  } catch {
    return undefined;
  }
}

function messageFrom(info: unknown, status: number): string {
  if (info && typeof info === "object" && "message" in info) {
    const message = (info as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (typeof info === "string" && info) return info;
  return `Request failed with status ${status}`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...options.headers,
  };
  if (options.authHeader) headers.Authorization = options.authHeader;

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      signal: options.signal,
      next: options.next,
      cache: options.cache,
    });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed",
      0,
      cause,
    );
  }

  if (!response.ok) {
    const info = await parseBody(response);
    throw new ApiError(messageFrom(info, response.status), response.status, info);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }
  return (await response.json()) as T;
}

function jsonBody(body: unknown, isFormData: boolean): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (isFormData) return body as FormData;
  return JSON.stringify(body);
}

export const apiClient = {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: "GET" }, options);
  },

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(
      path,
      {
        method: "POST",
        body: jsonBody(body, isFormData),
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
      },
      options,
    );
  },

  put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(
      path,
      {
        method: "PUT",
        body: jsonBody(body, isFormData),
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
      },
      options,
    );
  },

  delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return request<T>(path, { method: "DELETE" }, options);
  },
};
