/**
 * Utility and hook types for Fund-My-Cause
 * Type definitions for utilities, hooks, and helper functions
 */

import type { Campaign } from "./campaign";
import type { ContributionResponse, TransactionResponse } from "./api";

/**
 * Bookmark context type
 */
export interface BookmarkContextType {
  bookmarks: string[];
  isBookmarked: (campaignId: string) => boolean;
  addBookmark: (campaignId: string) => void;
  removeBookmark: (campaignId: string) => void;
}

/**
 * Comparison context type
 */
export interface ComparisonContextType {
  selectedCampaigns: Campaign[];
  addToComparison: (campaign: Campaign) => void;
  removeFromComparison: (campaignId: string) => void;
  clearComparison: () => void;
}

/**
 * Hook return type for campaign data
 */
export interface UseCampaignReturn {
  campaign: Campaign | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook return type for campaign list
 */
export interface UseCampaignsReturn {
  campaigns: Campaign[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook return type for wallet balance
 */
export interface UseWalletBalanceReturn {
  xlmBalance: number;
  tokenBalances: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook return type for contributions
 */
export interface UseContributionsReturn {
  contributions: ContributionResponse[];
  isLoading: boolean;
  error: Error | null;
  contribute: (campaignId: string, amount: number) => Promise<void>;
}

/**
 * Hook return type for transactions
 */
export interface UseTransactionsReturn {
  transactions: TransactionResponse[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Error logger type
 */
export interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Form state type
 */
export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
}

/**
 * Async operation state type
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

/**
 * Pagination state type
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * Filter state type
 */
export interface FilterState {
  status?: string;
  category?: string;
  minGoal?: number;
  maxGoal?: number;
  sortBy?: "recent" | "popular" | "trending" | "ending-soon";
  searchQuery?: string;
}

/**
 * Sort option type
 */
export interface SortOption {
  label: string;
  value: string;
  order: "asc" | "desc";
}

/**
 * Cache entry type
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * API request config type
 */
export interface ApiRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * API response config type
 */
export interface ApiResponseConfig<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: string;
}

/**
 * Retry policy type
 */
export interface RetryPolicy {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
}

/**
 * Rate limit info type
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * Return type of the useWallet hook.
 * Centralises wallet state so consumers can annotate return values precisely.
 */
export interface UseWalletReturn {
  /** Connected wallet address, or null when disconnected. */
  address: string | null;
  /** Current XLM balance string, or null before first fetch. */
  xlmBalance: string | null;
  /** Manually re-fetch the XLM balance. */
  refreshBalance: () => void;
  /** Open the wallet-select modal to initiate a connection. */
  connect: () => Promise<void>;
  /** Disconnect the active wallet and clear session. */
  disconnect: () => void;
  /** Sign a Stellar XDR transaction string with the connected wallet. */
  signTx: (xdr: string) => Promise<string>;
  /** True while the wallet is connecting for the first time. */
  isConnecting: boolean;
  /** True during the silent session auto-restore on mount. */
  isAutoConnecting: boolean;
  /** True while a transaction is waiting for wallet signature. */
  isSigning: boolean;
  /** Last wallet error message, or null. */
  error: string | null;
  /** True when the wallet is on a different network than the app. */
  networkMismatch: boolean;
  /** Stellar network name reported by the wallet extension. */
  walletNetwork: string | null;
}
