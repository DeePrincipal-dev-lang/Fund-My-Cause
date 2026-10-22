export { FmcClient }           from "./client";
export { FmcRegistryClient }   from "./registry";
export { FmcContractError, parseAndThrow } from "./errors";
export { xlmToStroops, stroopsToXlm, bpsToPercent, unixToDate, daysUntil, STROOPS_PER_XLM } from "./utils";
export { nodesFrom, fetchAllPages } from "./pagination";
export type { Connection, PageInfo } from "./pagination";
// Wallet-connect (adapters, session, error classification) is exported from
// the "@fund-my-cause/sdk/wallet" subpath rather than here, since it pulls in
// @stellar/freighter-api / @walletconnect/sign-client — optional peer deps
// that read-only consumers (e.g. campaign-list, event-listener) don't need.
export type {
  WalletProvider,
  WalletProviderState,
  MockWalletProviderConfig,
} from "./walletProvider";
export type {
  FmcClientConfig,
  RegistryClientConfig,
  SignFn,
  CampaignStatus,
  Category,
  CampaignStats,
  CampaignInfo,
  PerformanceMetrics,
  ContributionRecord,
  MatchingConfig,
  ContributeOptions,
  WithdrawOptions,
  RefundOptions,
  SetupMatchingOptions,
  RefundMatchingSponsorOptions,
  CancelOptions,
  ListContributorsOptions,
  ListOptions,
  ListByCategoryOptions,
} from "./types";
