"use client";

import React from "react";
import { AnimatePresence } from "framer-motion";
import { Gift, Users } from "lucide-react";
import type {
  Referral,
  ReferralRewardTier,
  GamificationProfile,
} from "@/types/gamification";
import { ReferralCodeCard } from "./referral/ReferralCodeCard";
import { ReferralTierDisplay } from "./referral/ReferralTierDisplay";
import { ReferralItem } from "./referral/ReferralItem";
import { SocialShareButtons } from "./referral/SocialShareButtons";

interface ReferralProgramProps {
  userProfile?: GamificationProfile;
  referrals?: Referral[];
  rewardTiers?: ReferralRewardTier[];
  totalRewardsEarned?: number;
  onShare?: (platform: string) => void;
  onCopyCode?: (code: string) => void;
  loading?: boolean;
}

/**
 * Main Referral Program Component
 */
export function ReferralProgram({
  userProfile,
  referrals = [],
  rewardTiers = [],
  totalRewardsEarned = 0,
  onShare,
  onCopyCode,
  loading = false,
}: ReferralProgramProps) {
  const referralCode = userProfile?.referralCode || "";
  const referralsCount = userProfile?.referralsCount || 0;

  const activeReferrals = referrals.filter(
    (r) => r.firstContributionAt !== undefined,
  );
  const pendingReferrals = referrals.filter(
    (r) => r.firstContributionAt === undefined,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Gift className="w-8 h-8 mx-auto mb-2 animate-bounce text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading referral program...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift size={32} />
          <div>
            <h2 className="text-2xl font-bold">Referral Program</h2>
            <p className="text-sm opacity-90">
              Earn rewards by referring friends
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Referrals</p>
            <p className="text-2xl font-bold">{referralsCount}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Active</p>
            <p className="text-2xl font-bold">{activeReferrals.length}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Earned</p>
            <p className="text-2xl font-bold">
              {(totalRewardsEarned / 1e7).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Referral code */}
      {referralCode && (
        <ReferralCodeCard
          code={referralCode}
          onCopy={() => onCopyCode?.(referralCode)}
        />
      )}

      {/* Social share */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Share with friends
        </h3>
        <SocialShareButtons referralCode={referralCode} onShare={onShare} />
      </div>

      {/* Reward tiers */}
      {rewardTiers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reward Tiers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {rewardTiers.map((tier, idx) => (
                <ReferralTierDisplay
                  key={tier.name}
                  tier={tier}
                  currentReferrals={referralsCount}
                  isCurrentTier={
                    referralsCount < tier.requiredReferrals &&
                    (idx === 0 ||
                      referralsCount >= rewardTiers[idx - 1].requiredReferrals)
                  }
                  isCompletedTier={referralsCount >= tier.requiredReferrals}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Referrals list */}
      {referrals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Referrals
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {activeReferrals.length} active, {pendingReferrals.length} pending
            </span>
          </div>

          {/* Active referrals */}
          {activeReferrals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Active Referrals
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeReferrals.map((referral) => (
                    <ReferralItem
                      key={referral.refereeAddress}
                      referral={referral}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Pending referrals */}
          {pendingReferrals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                ⏳ Awaiting Contribution
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {pendingReferrals.map((referral) => (
                    <ReferralItem
                      key={referral.refereeAddress}
                      referral={referral}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {referrals.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No referrals yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Share your referral code to get started earning rewards!
          </p>
        </div>
      )}
    </div>
  );
}

export default ReferralProgram;
