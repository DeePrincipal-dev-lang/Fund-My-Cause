/**
 * Hook for managing user achievements and gamification
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { AchievementTier, AchievementType } from "@/types/gamification";
import type {
  Achievement,
  AchievementProgress,
  GamificationProfile,
  AchievementUnlockedEvent,
} from "@/types/gamification";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface UseAchievementsParams {
  userAddress?: string;
  enabled?: boolean;
}

/**
 * Mock achievement definitions
 */
const ACHIEVEMENT_DEFINITIONS = {
  first_contribution: {
    title: "First Step",
    description: "Make your first contribution",
    icon: "🎬",
    tier: "common" as const,
  },
  super_supporter: {
    title: "Super Supporter",
    description: "Contribute to 10 different campaigns",
    icon: "⭐",
    tier: "uncommon" as const,
  },
  mega_donor: {
    title: "Mega Donor",
    description: "Reach a total of 1000 XLM in contributions",
    icon: "💰",
    tier: "rare" as const,
  },
  consistent_contributor: {
    title: "Consistent Contributor",
    description: "Contribute for 30 consecutive days",
    icon: "📅",
    tier: "rare" as const,
  },
  social_butterfly: {
    title: "Social Butterfly",
    description: "Share campaigns on 5 different platforms",
    icon: "🦋",
    tier: "uncommon" as const,
  },
  viral_sharer: {
    title: "Viral Sharer",
    description: "Get 100 clicks from your shared links",
    icon: "📢",
    tier: "epic" as const,
  },
  referral_champion: {
    title: "Referral Champion",
    description: "Refer 20 successful contributors",
    icon: "🎯",
    tier: "epic" as const,
  },
  campaign_completionist: {
    title: "Completionist",
    description: "Contribute to a campaign until it reaches its goal",
    icon: "✅",
    tier: "uncommon" as const,
  },
  milestone_hunter: {
    title: "Milestone Hunter",
    description: "Contribute to 5 campaigns that reached milestones",
    icon: "🏔️",
    tier: "rare" as const,
  },
  community_supporter: {
    title: "Community Supporter",
    description: "Contribute to 50+ community-focused campaigns",
    icon: "🤝",
    tier: "epic" as const,
  },
  early_bird: {
    title: "Early Bird",
    description: "Be among the first 10 contributors to a campaign",
    icon: "🐦",
    tier: "uncommon" as const,
  },
  goal_crusher: {
    title: "Goal Crusher",
    description: "Help 5 campaigns exceed their goal by 50%+",
    icon: "💪",
    tier: AchievementTier.LEGENDARY,
    xpReward: 2000,
  },
  [AchievementType.TRENDING_BACKER]: {
    title: "Trending Backer",
    description: "Be the top contributor to a trending campaign",
    icon: "🔥",
    tier: AchievementTier.LEGENDARY,
    xpReward: 2000,
  },
};

/**
 * Fetch user achievements
 */
async function fetchUserAchievements(
  _userAddress: string
): Promise<Achievement[]> {
  // Mocked pending Issue #12 (achievements contract: unlock conditions are
  // still TODO'd on-chain). Replace with a real contract/API read once #12 lands.
  const achievements: Achievement[] = [
    {
      id: "ach_1",
      type: AchievementType.FIRST_CONTRIBUTION,
      tier: AchievementTier.COMMON,
      title: "First Step",
      description: "Make your first contribution",
      icon: "🎬",
      earnedAt: Date.now() - 86400000 * 10, // 10 days ago
      isNFT: false,
    },
    {
      id: "ach_2",
      type: AchievementType.SUPER_SUPPORTER,
      tier: AchievementTier.UNCOMMON,
      title: "Super Supporter",
      description: "Contribute to 10 different campaigns",
      icon: "⭐",
      earnedAt: Date.now() - 86400000 * 5, // 5 days ago
      isNFT: true,
      unlockedPercentage: 15,
    },
  ];

  return achievements;
}

/**
 * Fetch user achievement progress
 */
async function fetchAchievementProgress(
  _userAddress: string
): Promise<AchievementProgress[]> {
  // Mocked pending Issue #12 (achievements contract: stub leaderboard ranking,
  // unlock conditions unresolved). Replace with a real contract/API read once #12 lands.
  const progress: AchievementProgress[] = [
    {
      type: AchievementType.MEGA_DONOR,
      title: "Mega Donor",
      description: "Reach a total of 1000 XLM in contributions",
      progress: 350,
      required: 1000,
      isUnlocked: false,
      icon: "💰",
      tier: AchievementTier.RARE,
    },
    {
      type: AchievementType.CONSISTENT_CONTRIBUTOR,
      title: "Consistent Contributor",
      description: "Contribute for 30 consecutive days",
      progress: 12,
      required: 30,
      isUnlocked: false,
      icon: "📅",
      tier: AchievementTier.RARE,
    },
    {
      type: AchievementType.REFERRAL_CHAMPION,
      title: "Referral Champion",
      description: "Refer 20 successful contributors",
      progress: 5,
      required: 20,
      isUnlocked: false,
      icon: "🎯",
      tier: AchievementTier.EPIC,
    },
  ];

  return progress;
}

/**
 * Fetch user gamification profile
 */
async function fetchGamificationProfile(
  userAddress: string
): Promise<GamificationProfile> {
  // Mocked pending Issue #12 (achievements contract not yet finished).
  // Replace with a real contract/API read once #12 lands.
  const profile: GamificationProfile = {
    address: userAddress,
    achievements: [],
    totalPoints: 2150,
    contributionStreak: 12,
    lastContributionDate: Date.now() - 86400000,
    referralCode: "FM" + userAddress.slice(0, 6).toUpperCase(),
    referralsCount: 5,
    leaderboardRank: 87,
    level: 5,
    badge: "Super Supporter",
  };

  return profile;
}

/**
 * Hook for user achievements
 */
export function useAchievements({
  userAddress,
  enabled = true,
}: UseAchievementsParams) {
  const queryClient = useQueryClient();

  // Fetch achievements
  const {
    data: achievements = [],
    isLoading: achievementsLoading,
    error: achievementsError,
  } = useQuery<Achievement[]>({
    queryKey: QUERY_KEYS.achievements(userAddress ?? ""),
    queryFn: () =>
      userAddress
        ? fetchUserAchievements(userAddress)
        : Promise.resolve([]),
    enabled: enabled && !!userAddress,
  });

  // Fetch achievement progress
  const {
    data: progressData = [],
    isLoading: progressLoading,
    error: progressError,
  } = useQuery<AchievementProgress[]>({
    queryKey: QUERY_KEYS.achievementProgress(userAddress ?? ""),
    queryFn: () =>
      userAddress
        ? fetchAchievementProgress(userAddress)
        : Promise.resolve([]),
    enabled: enabled && !!userAddress,
  });

  // Fetch gamification profile
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<GamificationProfile>({
    queryKey: QUERY_KEYS.gamificationProfile(userAddress ?? ""),
    queryFn: () =>
      userAddress
        ? fetchGamificationProfile(userAddress)
        : Promise.resolve(null as unknown as GamificationProfile),
    enabled: enabled && !!userAddress,
  });

  // Mutation to unlock achievement
  const unlockAchievementMutation = useMutation({
    mutationFn: async ({
      achievementType,
    }: {
      achievementType: AchievementType;
    }): Promise<AchievementUnlockedEvent> => {
      // Mocked pending Issue #12 (achievements contract's unlock_achievement()
      // entrypoint is unfinished). Replace with a real contract call once #12 lands.
      return {
        achievement: {
          id: `ach_${achievementType}`,
          type: achievementType,
          tier: AchievementTier.COMMON,
          title: "Achievement",
          description: "You unlocked an achievement",
          icon: "🏆",
          earnedAt: Date.now(),
        },
        unlockedAt: Date.now(),
        userLevel: profile?.level || 1,
        pointsEarned: 100,
        milestone: false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.achievements(userAddress ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.achievementProgress(userAddress ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gamificationProfile(userAddress ?? ""),
      });
    },
  });

  // Mutation to share achievement
  const shareAchievementMutation = useMutation({
    mutationFn: async ({
      achievementId: _achievementId,
      platform: _platform,
    }: {
      achievementId: string;
      platform: string;
    }): Promise<void> => {
      // Mocked pending Issue #12 (no share-tracking entrypoint on the
      // achievements contract yet). Replace with a real API/contract call once #12 lands.
    },
  });

  // Compute statistics
  const stats = useMemo(() => {
    const total = Object.keys(ACHIEVEMENT_DEFINITIONS).length;
    const unlocked = achievements.length;
    const completion = total > 0 ? (unlocked / total) * 100 : 0;

    return {
      total,
      unlocked,
      completion,
      nextMilestone:
        unlocked % 5 === 0
          ? unlocked + 5
          : Math.ceil(unlocked / 5) * 5,
    };
  }, [achievements]);

  return {
    // Data
    achievements,
    progressData,
    profile,
    stats,

    // Loading states
    loading: achievementsLoading || progressLoading || profileLoading,
    achievementsLoading,
    progressLoading,
    profileLoading,

    // Errors
    error: achievementsError || progressError || profileError,
    achievementsError,
    progressError,
    profileError,

    // Methods
    unlockAchievement: useCallback(
      (type: AchievementType) => {
        return unlockAchievementMutation.mutate({ achievementType: type });
      },
      [unlockAchievementMutation]
    ),
    shareAchievement: useCallback(
      (id: string, platform: string) => {
        return shareAchievementMutation.mutate({
          achievementId: id,
          platform,
        });
      },
      [shareAchievementMutation]
    ),

    // Mutations
    unlockAchievementMutation,
    shareAchievementMutation,
  };
}

export default useAchievements;
