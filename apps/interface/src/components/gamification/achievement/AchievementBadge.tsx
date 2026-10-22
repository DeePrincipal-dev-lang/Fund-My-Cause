"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Achievement,
  AchievementProgress,
  AchievementTier,
} from "@/types/gamification";

export const tierColors: Record<AchievementTier, string> = {
  common: "from-gray-400 to-gray-600",
  uncommon: "from-green-400 to-green-600",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-yellow-400 to-yellow-600",
};

interface AchievementBadgeProps {
  achievement?: Achievement;
  progress?: AchievementProgress;
  onShare?: () => void;
  isCompact?: boolean;
}

export function AchievementBadge({
  achievement,
  progress,
  isCompact = false,
}: AchievementBadgeProps) {
  const item = achievement || progress;
  if (!item) return null;

  const isUnlocked = achievement?.earnedAt || progress?.isUnlocked;
  const showProgress = progress && !isUnlocked;
  const progressPercent = progress
    ? (progress.progress / progress.required) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: isUnlocked ? 1.05 : 1 }}
      className={cn(
        "relative",
        isCompact ? "w-16 h-16" : "w-24 h-24",
        "flex flex-col items-center justify-center",
        "rounded-lg border transition-all duration-200",
        isUnlocked
          ? `border-2 bg-gradient-to-br ${tierColors[item.tier || "common"]} text-white shadow-lg`
          : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400",
      )}
    >
      <div className="text-2xl mb-1">{item.icon}</div>

      {!isUnlocked && (
        <div className="absolute top-1 right-1">
          <Lock size={12} className="text-gray-400" />
        </div>
      )}

      {showProgress && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx="50%"
            cy="50%"
            r="38%"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <circle
            cx="50%"
            cy="50%"
            r="38%"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${(Math.PI * 0.76 * progressPercent) / 100} 999`}
            className="text-yellow-400 transition-all duration-300"
          />
        </svg>
      )}

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap">
        <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded shadow-lg">
          {item.title}
          {showProgress && (
            <div className="text-xs mt-1">{`${progress.progress}/${progress.required}`}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
