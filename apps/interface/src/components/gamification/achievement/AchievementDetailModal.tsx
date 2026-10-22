"use client";

import React from "react";
import { motion } from "framer-motion";
import { Share2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types/gamification";
import { tierColors } from "./AchievementBadge";

interface AchievementDetailModalProps {
  achievement: Achievement;
  onClose: () => void;
  onShare?: () => void;
}

export function AchievementDetailModal({
  achievement,
  onClose,
  onShare,
}: AchievementDetailModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full",
          `bg-gradient-to-br ${tierColors[achievement.tier]} text-white shadow-2xl`,
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="text-6xl mb-4">{achievement.icon}</div>
          <h3 className="text-2xl font-bold mb-2">{achievement.title}</h3>
          <p className="text-sm opacity-90 mb-4">{achievement.description}</p>

          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            <div className="bg-white/20 rounded p-2">
              <div className="opacity-75 text-xs mb-1">Tier</div>
              <div className="font-semibold capitalize">{achievement.tier}</div>
            </div>
            <div className="bg-white/20 rounded p-2">
              <div className="opacity-75 text-xs mb-1">Rarity</div>
              <div className="font-semibold">
                {achievement.unlockedPercentage
                  ? `${(100 - achievement.unlockedPercentage).toFixed(1)}%`
                  : "Rare"}
              </div>
            </div>
          </div>

          {achievement.isNFT && (
            <div className="bg-white/20 rounded p-3 mb-6 text-sm">
              <div className="flex items-center gap-2 justify-center">
                <Trophy size={16} />
                <span>Minted as NFT</span>
              </div>
            </div>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="w-full bg-white text-current rounded-lg py-2 font-semibold hover:bg-white/90 transition flex items-center justify-center gap-2"
            >
              <Share2 size={16} />
              Share Achievement
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
