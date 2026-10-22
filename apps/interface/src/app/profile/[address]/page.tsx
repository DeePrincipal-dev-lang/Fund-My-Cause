"use client";

import React, { useState } from "react";
import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useWallet } from "@/hooks/useWallet";
import { readProfile, writeProfile } from "@/lib/profileStore";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsBar } from "@/components/profile/StatsBar";
import { CampaignsSection } from "@/components/profile/CampaignsSection";
import { ContributionsSection } from "@/components/profile/ContributionsSection";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { useContributions } from "@/hooks/useContributions";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useAchievements } from "@/hooks/useAchievements";
import { AchievementSystem } from "@/components/gamification/AchievementSystem";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { ReferralProgram } from "@/components/gamification/ReferralProgram";
import type { ProfileData } from "@/types/profile";
import type { CampaignData } from "@fund-my-cause/types";
import { AchievementType, type LeaderboardEntry } from "@/types/gamification";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

// Mock leaderboard rows pending Issue #12 (real contract-backed ranking).
function buildMockLeaderboard(address: string): LeaderboardEntry[] {
  return [
    {
      rank: 1,
      address,
      displayName: "You",
      totalPoints: 2150,
      contributionCount: 14,
      level: 5,
      achievements: 2,
      badge: "Super Supporter",
    },
    {
      rank: 2,
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW",
      totalPoints: 1890,
      contributionCount: 11,
      level: 4,
      achievements: 3,
    },
    {
      rank: 3,
      address: "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGFED",
      totalPoints: 1420,
      contributionCount: 9,
      level: 3,
      achievements: 1,
    },
  ];
}

/** Validates a Stellar G... public key format (basic check) */
function isValidStellarAddress(addr: string): boolean {
  return typeof addr === "string" && /^G[A-Z2-7]{55}$/.test(addr);
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: walletAddress } = useWallet();
  const { address } = use(params);

  // Profile metadata state
  const [profile, setProfile] = useState<ProfileData>(() => {
    // Only read from localStorage on the client after hydration
    if (typeof window === "undefined") {
      return { avatarUri: "", bio: "", socialLinks: [] };
    }
    return readProfile(address);
  });

  const [editOpen, setEditOpen] = useState(false);

  // Contribution data for stats
  const { contributions, loading: contribLoading } = useContributions(address);

  // Stats (campaigns fetched inside CampaignsSection; we use a lightweight version here)
  const [creatorCampaigns, setCreatorCampaigns] = useState<CampaignData[]>([]);
  const stats = useProfileStats(creatorCampaigns, contributions);

  const isOwner = !!walletAddress && walletAddress === address;

  const {
    achievements,
    progressData,
    profile: gamificationProfile,
    loading: gamificationLoading,
    unlockAchievement,
    shareAchievement,
  } = useAchievements({ userAddress: address });

  // Validate address format
  if (!isValidStellarAddress(address)) {
    return (
      <BreadcrumbProvider>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
          <Navbar />
          <div className="max-w-2xl mx-auto px-6 py-16 text-center">
            <p className="text-red-500 text-lg font-semibold">
              Invalid Stellar address format.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Profile addresses must be a valid Stellar public key (G…).
            </p>
          </div>
        </main>
      </BreadcrumbProvider>
    );
  }

  const handleSave = (updated: ProfileData) => {
    writeProfile(address, updated);
    setProfile(updated);
    setEditOpen(false);
  };

  return (
    <BreadcrumbProvider>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
          <Breadcrumb
            crumbs={[{ label: "Profile" }]}
            className="text-gray-500"
          />

          {/* Profile header */}
          <ProfileHeader
            address={address}
            profile={profile}
            isOwner={isOwner}
            onEdit={() => setEditOpen(true)}
          />

          {/* Stats bar */}
          <StatsBar
            campaignCount={stats.campaignCount}
            totalRaised={stats.totalRaised}
            contributionCount={stats.contributionCount}
            totalContributed={stats.totalContributed}
            loading={contribLoading}
          />

          {/* Campaigns created */}
          <CampaignsSection
            address={address}
            onCampaignsLoaded={setCreatorCampaigns}
          />

          {/* Contribution history */}
          <ContributionsSection address={address} />

          {/* Gamification: achievements, leaderboard, referrals */}
          <section data-testid="gamification-section" className="space-y-8">
            <AchievementSystem
              userProfile={gamificationProfile}
              achievements={achievements}
              progressData={progressData}
              loading={gamificationLoading}
              onShareAchievement={(a) => shareAchievement(a.id, "twitter")}
            />

            {isOwner && (
              <button
                type="button"
                onClick={() =>
                  unlockAchievement(AchievementType.FIRST_CONTRIBUTION)
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Unlock First Contribution Achievement
              </button>
            )}

            <Leaderboard
              entries={buildMockLeaderboard(address)}
              userAddress={address}
            />

            <ReferralProgram userProfile={gamificationProfile} />
          </section>
        </div>

        {/* Edit modal */}
        {editOpen && (
          <EditProfileModal
            address={address}
            current={profile}
            onSave={handleSave}
            onClose={() => setEditOpen(false)}
          />
        )}
      </main>
    </BreadcrumbProvider>
  );
}
