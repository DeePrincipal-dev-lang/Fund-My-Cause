"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Achievement,
  AchievementProgress,
  GamificationProfile,
} from "@/types/gamification";
import { AchievementBadge } from "./achievement/AchievementBadge";
import { AchievementDetailModal } from "./achievement/AchievementDetailModal";

interface AchievementSystemProps {
  userProfile?: GamificationProfile;
  achievements?: Achievement[];
  progressData?: AchievementProgress[];
  onShareAchievement?: (achievement: Achievement) => void;
  loading?: boolean;
}

export function AchievementSystem({
  userProfile,
  achievements = [],
  progressData = [],
  onShareAchievement,
  loading = false,
}: AchievementSystemProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<
    Achievement | undefined
  >();
  const [view, setView] = useState<"unlocked" | "progress" | "all">("all");

  const unlockedAchievements = achievements.filter((a) => a.earnedAt);
  const lockedAchievements = achievements.filter((a) => !a.earnedAt);

  const unlockedCount = unlockedAchievements.length;
  const totalCount = achievements.length;
  const completionPercent =
    totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Award className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading achievements...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <Trophy size={32} />
          <div>
            <h2 className="text-2xl font-bold">Achievement System</h2>
            <p className="text-sm opacity-90">Level {userProfile?.level || 1}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Progress</span>
            <span className="font-semibold">
              {unlockedCount}/{totalCount}
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {["all", "unlocked", "progress"].map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab as "unlocked" | "progress" | "all")}
            className={cn(
              "px-4 py-2 font-medium text-sm transition-colors capitalize",
              view === tab
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
          >
            {tab === "progress" ? "In Progress" : tab}
            {tab === "unlocked" && ` (${unlockedCount})`}
            {tab === "progress" && ` (${lockedAchievements.length})`}
          </button>
        ))}
      </div>

      {/* Achievements grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <AnimatePresence mode="popLayout">
          {view === "all" || view === "unlocked"
            ? unlockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="cursor-pointer group"
                  onClick={() => setSelectedAchievement(achievement)}
                >
                  <AchievementBadge achievement={achievement} onShare={() => {}} />
                  <div className="mt-2 text-center hidden group-hover:block">
                    <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">
                      {achievement.title}
                    </p>
                  </div>
                </div>
              ))
            : null}

          {view === "all" || view === "progress"
            ? progressData.map((progress) => (
                <div key={progress.type} className="cursor-pointer group">
                  <AchievementBadge progress={progress} />
                  <div className="mt-2 text-center hidden group-hover:block">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {progress.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {progress.progress}/{progress.required}
                    </p>
                  </div>
                </div>
              ))
            : null}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {view === "unlocked" && unlockedAchievements.length === 0 && (
        <div className="text-center py-12">
          <Lock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No achievements unlocked yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Start contributing to unlock achievements!
          </p>
        </div>
      )}

      {/* Achievement detail modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <AchievementDetailModal
            achievement={selectedAchievement}
            onClose={() => setSelectedAchievement(undefined)}
            onShare={() => {
              onShareAchievement?.(selectedAchievement);
              setSelectedAchievement(undefined);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AchievementSystem;
