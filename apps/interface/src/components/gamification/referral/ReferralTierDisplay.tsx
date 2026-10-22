"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralRewardTier } from "@/types/gamification";

interface ReferralTierDisplayProps {
  tier: ReferralRewardTier;
  currentReferrals: number;
  isCurrentTier: boolean;
  isCompletedTier: boolean;
}

export function ReferralTierDisplay({
  tier,
  currentReferrals,
  isCurrentTier,
  isCompletedTier,
}: ReferralTierDisplayProps) {
  const progress = Math.min(
    100,
    (currentReferrals / tier.requiredReferrals) * 100,
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "p-4 rounded-lg border-2 transition-all",
        isCurrentTier
          ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
          : isCompletedTier
            ? "border-green-400 bg-green-50 dark:bg-green-900/20"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {tier.name}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Refer {tier.requiredReferrals} people
          </p>
        </div>
        {isCompletedTier && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {currentReferrals}/{tier.requiredReferrals}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
            className={cn(
              "h-full rounded-full",
              isCompletedTier
                ? "bg-green-500"
                : isCurrentTier
                  ? "bg-yellow-500"
                  : "bg-blue-500",
            )}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded p-3">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
          Reward per referral
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            {tier.bonus}x Bonus
          </span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            +{(tier.rewardAmount / 1e7).toFixed(2)} XLM
          </span>
        </div>
      </div>
    </motion.div>
  );
}
