"use client";

import React from "react";
import { motion } from "framer-motion";
import { Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/gamification";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  showAddresses: boolean;
}

const medalIcons = {
  1: <Medal className="w-5 h-5 text-yellow-500" />,
  2: <Medal className="w-5 h-5 text-gray-400" />,
  3: <Medal className="w-5 h-5 text-orange-400" />,
};

function formatAddress(address: string, show: boolean = true): string {
  if (!show) return "••••••••";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function LeaderboardRow({
  entry,
  isCurrentUser,
  showAddresses,
}: LeaderboardRowProps) {
  const isTopThree = entry.rank <= 3;
  const medal = medalIcons[entry.rank as 1 | 2 | 3];

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "border-b border-gray-200 dark:border-gray-700 last:border-0 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isCurrentUser && "bg-blue-50 dark:bg-blue-900/20",
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isTopThree ? (
            medal
          ) : (
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 w-5">
              {entry.rank}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {entry.displayName ? (
            <>
              <span className="font-medium text-gray-900 dark:text-white">
                {entry.displayName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAddress(entry.address, showAddresses)}
              </span>
            </>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {formatAddress(entry.address, showAddresses)}
            </span>
          )}
          {isCurrentUser && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              You
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {entry.level}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Lvl</span>
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="font-semibold text-gray-900 dark:text-white">
          {entry.totalPoints.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">points</div>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="font-semibold text-gray-900 dark:text-white">
          {entry.contributionCount}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          contribution{entry.contributionCount !== 1 ? "s" : ""}
        </div>
      </td>

      <td className="px-4 py-3 text-center">
        <div className="inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-3 py-1 rounded-full text-sm font-medium">
          <Trophy size={14} />
          {entry.achievements}
        </div>
      </td>

      {entry.badge && (
        <td className="px-4 py-3">
          <span className="text-sm px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full">
            ⭐ {entry.badge}
          </span>
        </td>
      )}
    </motion.tr>
  );
}
