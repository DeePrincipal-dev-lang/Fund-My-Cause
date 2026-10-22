"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, Users, Zap } from "lucide-react";
import type { Referral } from "@/types/gamification";

export function ReferralItem({ referral }: { referral: Referral }) {
  const isActive = referral.firstContributionAt !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Users size={20} className="text-gray-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
            {referral.refereeAddress.slice(0, 10)}...
            {referral.refereeAddress.slice(-8)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isActive ? "Active contributor" : "Awaiting contribution"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2">
        {isActive && (
          <div className="text-right">
            <div className="font-semibold text-green-600 dark:text-green-400">
              +{(referral.rewardAmount / 1e7).toFixed(2)} XLM
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Earned
            </div>
          </div>
        )}
        {referral.rewardClaimed ? (
          <CheckCircle size={20} className="text-green-500" />
        ) : (
          <Zap size={20} className="text-yellow-500" />
        )}
      </div>
    </motion.div>
  );
}
