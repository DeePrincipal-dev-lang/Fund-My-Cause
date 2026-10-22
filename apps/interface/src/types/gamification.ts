/**
 * Gamification types and interfaces for Fund My Cause.
 * Defines achievement, leaderboard, referral, and challenge structures.
 */

/**
 * Achievement badge types
 */
export enum AchievementType {
  // Contribution achievements
  FIRST_CONTRIBUTION = "first_contribution",
  SUPER_SUPPORTER = "super_supporter",
  MEGA_DONOR = "mega_donor",
  CONSISTENT_CONTRIBUTOR = "consistent_contributor",

  // Social achievements
  SOCIAL_BUTTERFLY = "social_butterfly",
  VIRAL_SHARER = "viral_sharer",
  REFERRAL_CHAMPION = "referral_champion",

  // Engagement achievements
  CAMPAIGN_COMPLETIONIST = "campaign_completionist",
  MILESTONE_HUNTER = "milestone_hunter",
  COMMUNITY_SUPPORTER = "community_supporter",

  // Special achievements
  EARLY_BIRD = "early_bird",
  GOAL_CRUSHER = "goal_crusher",
  TRENDING_BACKER = "trending_backer",
}

/**
 * Achievement tier (rarity)
 */
export enum AchievementTier {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

/**
 * Single achievement earned by a user
 */
export interface Achievement {
  id: string;
  type: AchievementType;
  tier: AchievementTier;
  title: string;
  description: string;
  icon: string;
  earnedAt: number; // Unix timestamp
  isNFT?: boolean;
  nftContractId?: string;
  nftTokenId?: string;
  unlockedPercentage?: number; // 0-100, percentage of users with this achievement
}

/**
 * User achievement progress
 */
export interface AchievementProgress {
  type: AchievementType;
  title: string;
  description: string;
  progress: number; // Current progress
  required: number; // Required to unlock
  isUnlocked: boolean;
  unlockedAt?: number;
  icon: string;
  tier: AchievementTier;
}

/**
 * User gamification profile
 */
export interface GamificationProfile {
  address: string;
  achievements: Achievement[];
  totalPoints: number;
  contributionStreak: number;
  lastContributionDate?: number;
  referralCode: string;
  referralsCount: number;
  leaderboardRank?: number;
  level: number; // 1-100, increases with points
  badge?: string; // Current badge/title
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  totalPoints: number;
  contributionCount: number;
  level: number;
  achievements: number; // Count of achievements
  badge?: string;
}

/**
 * User contribution record for leaderboard.
 * Distinct from the shared ContributionRecord in @fund-my-cause/types
 * which represents contract-level contribution data.
 */
export interface GamificationContributionRecord {
  address: string;
  displayName?: string;
  totalContributed: number; // In stroops
  contributionCount: number;
  achievements: number;
}

/**
 * Referral information
 */
export interface Referral {
  referrerAddress: string;
  refereeAddress: string;
  referralCode: string;
  createdAt: number;
  firstContributionAt?: number;
  rewardClaimed: boolean;
  rewardAmount: number; // In stroops
}

/**
 * Referral reward tier
 */
export interface ReferralRewardTier {
  name: string;
  requiredReferrals: number;
  rewardAmount: number; // In stroops
  bonus: number; // Bonus multiplier (e.g., 1.5 = 50% bonus)
}

/**
 * Challenge/competition
 */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: "contribution" | "referral" | "social" | "milestone";
  startDate: number;
  endDate: number;
  targetAmount: number;
  currentAmount?: number;
  rewardPool: number; // Total reward in stroops
  participants?: number;
  leaderboard?: ChallengeLeaderboardEntry[];
  rules: string[];
}

/**
 * Challenge leaderboard entry
 */
export interface ChallengeLeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  contribution: number;
  reward: number; // Reward earned
}

/**
 * User streak information
 */
export interface ContributionStreak {
  address: string;
  currentStreak: number; // Days
  longestStreak: number; // Days
  lastContributionDate: number;
  streakMilestones: number[]; // Dates of streak milestones (7, 30, 60, 100 days)
}

/**
 * Milestone celebration
 */
export interface MilestoneCelebration {
  type: "campaign_goal" | "contribution_milestone" | "streak_milestone";
  title: string;
  message: string;
  icon: string;
  animationType: "confetti" | "fireworks" | "balloons" | "sparkles";
  soundEffect?: string;
}

/**
 * Achievement unlocked event
 */
export interface AchievementUnlockedEvent {
  achievement: Achievement;
  unlockedAt: number;
  userLevel: number;
  pointsEarned: number;
  milestone: boolean; // First time this tier has been reached
}

/**
 * Leaderboard filter options
 */
export interface LeaderboardFilter {
  timeframe?: "all-time" | "this-month" | "this-week";
  type?: "points" | "contributions" | "achievements" | "referrals";
  category?: "contributors" | "referrers" | "challenge-participants";
  page?: number;
  pageSize?: number;
}

/**
 * Social share configuration
 */
export interface SocialShareConfig {
  platform: "twitter" | "facebook" | "linkedin" | "telegram" | "whatsapp";
  url: string;
  message: string;
  hashtags: string[];
  trackingCode?: string;
}

/**
 * Gamification statistics
 */
export interface GamificationStats {
  totalAchievements: number;
  totalUsers: number;
  totalContributionsTracked: number;
  totalReferrals: number;
  averageStreak: number;
  averageLevel: number;
  averagePointsPerUser: number;
}

/**
 * User profile with gamification data
 */
export interface UserProfileWithGamification {
  address: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  joinDate: number;
  gamification: GamificationProfile;
  contributions: GamificationContributionRecord;
  streak: ContributionStreak;
  recentAchievements: Achievement[];
  referralStats: {
    referralsCount: number;
    rewardEarned: number;
    topReferrals: ReferralInfo[];
  };
}

/**
 * Basic referral info for display
 */
export interface ReferralInfo {
  address: string;
  displayName?: string;
  contributedAt?: number;
}

/**
 * Notification for gamification events
 */
export interface GamificationNotification {
  id: string;
  type: "achievement" | "levelup" | "challenge" | "referral" | "streak";
  title: string;
  message: string;
  icon: string;
  createdAt: number;
  actionUrl?: string;
  read: boolean;
}
