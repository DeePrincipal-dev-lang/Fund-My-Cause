"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SocialShareButtonsProps {
  referralCode: string;
  onShare?: (platform: string) => void;
}

export function SocialShareButtons({
  referralCode,
  onShare,
}: SocialShareButtonsProps) {
  const socialPlatforms = [
    {
      name: "Twitter",
      icon: "𝕏",
      color: "bg-gray-900 hover:bg-gray-800",
      message: `Check out Fund My Cause! Use my referral code ${referralCode} and earn rewards together. 🚀 #FundMyCause #Web3`,
    },
    {
      name: "Facebook",
      icon: "f",
      color: "bg-blue-600 hover:bg-blue-700",
      message: `Join Fund My Cause using my referral code: ${referralCode}`,
    },
    {
      name: "LinkedIn",
      icon: "in",
      color: "bg-blue-700 hover:bg-blue-800",
      message: `Discover Fund My Cause - supporting innovative projects. Referral code: ${referralCode}`,
    },
    {
      name: "Telegram",
      icon: "✈",
      color: "bg-blue-400 hover:bg-blue-500",
      message: `Fund My Cause - referral code: ${referralCode}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {socialPlatforms.map((platform) => (
        <button
          key={platform.name}
          onClick={() => onShare?.(platform.name)}
          className={cn(
            "p-4 rounded-lg text-white font-semibold text-sm transition-all hover:scale-105",
            platform.color,
          )}
          title={`Share on ${platform.name}`}
        >
          <div className="text-xl mb-1">{platform.icon}</div>
          <div>{platform.name}</div>
        </button>
      ))}
    </div>
  );
}
