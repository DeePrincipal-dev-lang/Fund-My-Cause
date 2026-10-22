/**
 * Central export for all application types.
 * Domain types are re-exported from @fund-my-cause/types to prevent drift.
 * Frontend-specific types (component props, hooks, contexts) remain local.
 */

// Domain types - re-exported from shared package
export type {
  Campaign,
  FAQ,
  TeamMember,
  TrustSignalData,
  CampaignStatus,
  CampaignInfo,
  CampaignStats,
  PlatformConfig,
  StatusVariant,
  ContributionRecord,
  InitializeParams,
  CampaignData,
  Milestone,
  MilestoneInput,
  Comment,
  CommentInput,
  CommentVote,
  ApiResponse,
  ApiError,
  PaginatedResponse,
  CampaignListResponse,
  CampaignResponse,
  FAQResponse,
  TeamMemberResponse,
  MilestoneResponse,
  ContributionResponse,
  UserProfileResponse,
  TransactionResponse,
  WalletBalanceResponse,
  SearchResponse,
  StatisticsResponse,
  NotificationResponse,
  CommentResponse,
  ActivityFeedResponse,
} from "@fund-my-cause/types";

// Contract types (frontend-specific)
export type { SignFn } from "./contract";
export { ContractError } from "./contract";

// Component prop types
export type {
  ModalProps,
  ButtonProps,
  InputProps,
  CardProps,
  ProgressBarProps,
  CampaignCardProps,
  PledgeModalProps,
  CountdownTimerProps,
  ShareModalProps,
  TransactionStatusProps,
  NavbarProps,
  LoadingSkeletonProps,
  EmptyStateProps,
  ErrorBoundaryProps,
  ToastProps,
  CommentSectionProps,
  ActivityFeedProps,
  ContributionLeaderboardProps,
  FAQAccordionProps,
  TeamMemberCardProps,
  WalletBalanceProps,
  NotificationDropdownProps,
  MilestoneDisplayProps,
  TrustSignalsProps,
  MilestoneInputProps,
  CampaignPreviewProps,
  EmbedCodeGeneratorProps,
  VideoPlayerProps,
} from "./components";

// Utility and hook types
export type {
  BookmarkContextType,
  ComparisonContextType,
  UseCampaignReturn,
  UseCampaignsReturn,
  UseWalletBalanceReturn,
  UseContributionsReturn,
  UseTransactionsReturn,
  UseWalletReturn,
  ErrorLog,
  ValidationResult,
  FormState,
  AsyncState,
  PaginationState,
  FilterState,
  SortOption,
  CacheEntry,
  ApiRequestConfig,
  ApiResponseConfig,
  RetryPolicy,
  RateLimitInfo,
} from "./utils";
