// ./graphql and ./graphql-server are deliberately not re-exported here: both
// describe the GraphQL schema and so declare names (Campaign, Milestone, ...)
// that would collide with the domain types below. Import them from
// "@fund-my-cause/types/graphql" and "@fund-my-cause/types/graphql-server".

export type { Campaign, FAQ, TeamMember, TrustSignalData } from "./campaign";

export { CAMPAIGN_STATUS_VALUES } from "./soroban";

export type {
  CampaignStatus,
  CampaignInfo,
  CampaignStats,
  PlatformConfig,
  StatusVariant,
  ContributionRecord,
  InitializeParams,
  CampaignData,
} from "./soroban";

export type { Milestone, MilestoneInput } from "./milestone";

export type { Comment, CommentInput, CommentVote } from "./comment";

export type { IndexerEvent } from "./indexer";

export type {
  ContractCategory,
  RawCampaignInfo,
  RawCampaignStats,
  RawPerformanceMetrics,
  RawCampaignIdList,
} from "./contract";

export type {
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
} from "./api";

export * from "./validation";

export const CAMPAIGN_TITLE_MAX_LENGTH = 100;
export const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 1000;
export const CAMPAIGN_DEADLINE_MIN_HOURS = 1;
export const CAMPAIGN_DEADLINE_MAX_YEARS = 1;
export const DONATION_MIN_XLM = 1;
export const XLM_TO_STROOPS = 10_000_000;

export { validateTitle as validateCampaignTitle } from "./validation";
export { validateDescription as validateCampaignDescription } from "./validation";
export { validateGoal as validateCampaignGoal } from "./validation";
export { validateDeadline as validateCampaignDeadline } from "./validation";
export { validateMinContribution as validateMinContributionShared } from "./validation";
export { validateFeeBps } from "./validation";

