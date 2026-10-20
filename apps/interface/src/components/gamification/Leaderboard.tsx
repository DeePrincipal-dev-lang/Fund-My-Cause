"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/gamification";
import { LeaderboardRow } from "./leaderboard/LeaderboardRow";
import { LeaderboardControls } from "./leaderboard/LeaderboardControls";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  userAddress?: string;
  timeframe?: "all-time" | "this-month" | "this-week";
  type?: "points" | "contributions" | "achievements" | "referrals";
  onTimeframeChange?: (timeframe: "all-time" | "this-month" | "this-week") => void;
  onTypeChange?: (type: "points" | "contributions" | "achievements" | "referrals") => void;
  loading?: boolean;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
}

export function Leaderboard({
  entries,
  userAddress,
  timeframe = "all-time",
  type = "points",
  onTimeframeChange,
  onTypeChange,
  loading = false,
  totalPages = 1,
  currentPage = 0,
  onPageChange,
}: LeaderboardProps) {
  const [showAddresses, setShowAddresses] = useState(false);

  const typeLabels = {
    points: "Top Points",
    contributions: "Top Contributors",
    achievements: "Achievement Hunters",
    referrals: "Referral Champions",
  };

  const userInLeaderboard = entries.find((e) => e.address === userAddress);
  const userRank = userInLeaderboard?.rank;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 animate-bounce text-yellow-500" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading leaderboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={32} />
          <div>
            <h2 className="text-2xl font-bold">{typeLabels[type]}</h2>
            {userRank && (
              <p className="text-sm opacity-90">
                Your rank: #{userRank} 🎯
              </p>
            )}
          </div>
        </div>
      </div>

      <LeaderboardControls
        timeframe={timeframe}
        type={type}
        showAddresses={showAddresses}
        onTimeframeChange={onTimeframeChange}
        onTypeChange={onTypeChange}
        onToggleAddresses={() => setShowAddresses(!showAddresses)}
      />

      {/* Leaderboard table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                Rank
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                User
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white"
              >
                Level
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white"
              >
                {type === "points"
                  ? "Points"
                  : type === "contributions"
                    ? "Contributed"
                    : "Achievements"}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white"
              >
                Contributions
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white"
              >
                Badges
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.address}
                  entry={entry}
                  isCurrentUser={entry.address === userAddress}
                  showAddresses={showAddresses}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No leaderboard data available
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage === 0}
            className={cn(
              "p-2 rounded-lg transition-colors",
              currentPage === 0
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage + 1} of {totalPages}
          </div>

          <button
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className={cn(
              "p-2 rounded-lg transition-colors",
              currentPage >= totalPages - 1
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
