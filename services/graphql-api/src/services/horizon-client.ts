/**
 * horizon-client.ts
 * ──────────────────
 * Centralized Horizon HTTP client that wraps all outbound Horizon requests
 * with retry and circuit-breaker policies. This ensures a single point of
 * control over network resilience patterns and makes testing easier by
 * allowing dependency injection.
 *
 * Previously, services reached Horizon directly via fetch() or indirectly
 * through the Stellar SDK. This client routes all Horizon traffic through
 * one place.
 */

import { logger } from "../logger.js";
import { HorizonCircuitBreaker } from "./horizon-circuit-breaker.js";

/**
 * Configuration for the Horizon client.
 */
export interface HorizonClientConfig {
  /** Base URL of the Horizon API (e.g., https://horizon.stellar.org) */
  horizonUrl: string;
  /** Optional circuit breaker configuration */
  circuitBreakerOptions?: {
    failureThreshold?: number;
    cooldownMs?: number;
  };
  /** Optional custom logger */
  logger?: any;
}

/**
 * Result of a Horizon API call that may fail or be circuit-opened.
 */
export interface HorizonResponse<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
}

/**
 * HorizonClient
 * ─────────────
 * Manages all outbound Horizon HTTP requests with built-in resilience.
 * Each call is routed through the circuit breaker.
 */
export class HorizonClient {
  private readonly horizonUrl: string;
  private readonly circuitBreaker: HorizonCircuitBreaker;
  private readonly log: any;

  constructor(config: HorizonClientConfig) {
    this.horizonUrl = config.horizonUrl.replace(/\/$/, ""); // Remove trailing slash
    this.circuitBreaker = new HorizonCircuitBreaker(
      config.circuitBreakerOptions
    );
    this.log = config.logger || logger;
  }

  /**
   * Get the current state of the circuit breaker.
   * Useful for monitoring and health checks.
   */
  getCircuitState() {
    return this.circuitBreaker.getState();
  }

  /**
   * Fetch account details from Horizon.
   *
   * @param accountId - Stellar account public key
   * @returns Account information or error
   */
  async getAccount(accountId: string): Promise<HorizonResponse<any>> {
    return this.call(`/accounts/${accountId}`);
  }

  /**
   * Fetch account's transaction history from Horizon.
   *
   * @param accountId - Stellar account public key
   * @param params - Query parameters (limit, order, cursor, etc.)
   * @returns Transaction list or error
   */
  async getAccountTransactions(
    accountId: string,
    params?: Record<string, any>
  ): Promise<HorizonResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    return this.call(
      `/accounts/${accountId}/transactions${queryString ? `?${queryString}` : ""}`
    );
  }

  /**
   * Fetch account's operations from Horizon.
   *
   * @param accountId - Stellar account public key
   * @param params - Query parameters
   * @returns Operations list or error
   */
  async getAccountOperations(
    accountId: string,
    params?: Record<string, any>
  ): Promise<HorizonResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    return this.call(
      `/accounts/${accountId}/operations${queryString ? `?${queryString}` : ""}`
    );
  }

  /**
   * Fetch transaction details from Horizon.
   *
   * @param transactionHash - Transaction hash/ID
   * @returns Transaction details or error
   */
  async getTransaction(transactionHash: string): Promise<HorizonResponse<any>> {
    return this.call(`/transactions/${transactionHash}`);
  }

  /**
   * Fetch operation details from Horizon.
   *
   * @param operationId - Operation ID
   * @returns Operation details or error
   */
  async getOperation(operationId: string): Promise<HorizonResponse<any>> {
    return this.call(`/operations/${operationId}`);
  }

  /**
   * Submit a signed transaction to Horizon.
   *
   * @param transactionEnvelope - XDR-encoded transaction
   * @returns Submission result or error
   */
  async submitTransaction(
    transactionEnvelope: string
  ): Promise<HorizonResponse<any>> {
    return this.call("/transactions", {
      method: "POST",
      body: JSON.stringify({ tx: transactionEnvelope }),
    });
  }

  /**
   * Fetch the Horizon server's root endpoint (system status).
   *
   * @returns Server metadata and status
   */
  async getRoot(): Promise<HorizonResponse<any>> {
    return this.call("/");
  }

  /**
   * Generic HTTP call wrapper with circuit breaker.
   * All public methods use this internally.
   *
   * @param path - Horizon API path (e.g., "/accounts/ABC...")
   * @param options - Fetch options (method, headers, body, etc.)
   * @returns Response data or error result
   */
  private async call(
    path: string,
    options: RequestInit = {}
  ): Promise<HorizonResponse<any>> {
    try {
      // Check circuit breaker state first
      if (!this.circuitBreaker.canExecute()) {
        const error = this.circuitBreaker.getLastError();
        this.log.warn(
          { path, circuitState: this.circuitBreaker.getState() },
          "Horizon call rejected: circuit breaker is open"
        );
        return {
          ok: false,
          error: error?.message || "Circuit breaker is open",
        };
      }

      // Make the actual call through the circuit breaker
      return await this.circuitBreaker.execute(async () => {
        const url = `${this.horizonUrl}${path}`;
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          ...options,
          timeout: 30_000, // 30 second timeout
        } as any);

        if (!response.ok) {
          throw new Error(
            `Horizon HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();
        return {
          ok: true,
          status: response.status,
          data,
        };
      });
    } catch (error: any) {
      this.log.error(
        {
          path,
          err: error,
          circuitState: this.circuitBreaker.getState(),
        },
        "Horizon call failed"
      );

      return {
        ok: false,
        error: error?.message || "Unknown error",
      };
    }
  }
}

/**
 * Factory function to create a HorizonClient singleton for dependency injection.
 * This ensures all parts of the application use the same client with the same
 * circuit breaker state.
 */
let clientInstance: HorizonClient | null = null;

export function getOrCreateHorizonClient(
  config: HorizonClientConfig
): HorizonClient {
  if (!clientInstance) {
    clientInstance = new HorizonClient(config);
  }
  return clientInstance;
}

/**
 * Reset the singleton client (primarily for testing).
 */
export function resetHorizonClient(): void {
  clientInstance = null;
}
