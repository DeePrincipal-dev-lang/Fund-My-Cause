"use client";

import React, { useState } from "react";
import { Copy, Check, Edit2 } from "lucide-react";
import { formatAddress } from "@/lib/format";
import type { ProfileData } from "@/types/profile";

// ── Social platform detection ─────────────────────────────────────────────

function detectPlatform(url: string): "twitter" | "github" | "linkedin" | null {
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  if (/github\.com/i.test(url)) return "github";
  if (/linkedin\.com/i.test(url)) return "linkedin";
  return null;
}

function PlatformIcon({
  platform,
}: {
  platform: ReturnType<typeof detectPlatform>;
}) {
  if (platform === "twitter") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.633 5.903-5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (platform === "github") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (platform === "linkedin") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  return null;
}

// ── Identicon fallback ────────────────────────────────────────────────────────

function Identicon({ address }: { address: string }) {
  // Deterministic background color from address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) & 0xffffffff;
  }
  const hue = Math.abs(hash) % 360;
  const initials = address.slice(0, 2).toUpperCase();

  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl select-none"
      style={{ backgroundColor: `hsl(${hue}, 60%, 40%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ── ProfileHeader ─────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  address: string;
  profile: ProfileData;
  isOwner: boolean;
  onEdit: () => void;
}

export function ProfileHeader({
  address,
  profile,
  isOwner,
  onEdit,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left sm:items-start">
      {/* Avatar */}
      {profile.avatarUri ? (
        <img
          src={
            profile.avatarUri.startsWith("ipfs://")
              ? `https://gateway.pinata.cloud/ipfs/${profile.avatarUri.slice(7)}`
              : profile.avatarUri
          }
          alt="Profile avatar"
          className="w-20 h-20 rounded-full object-cover shrink-0"
        />
      ) : (
        <Identicon address={address} />
      )}

      {/* Info */}
      <div className="flex-1 space-y-2">
        {/* Address */}
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <span className="font-mono text-sm text-gray-400" title={address}>
            {formatAddress(address, 6, 4)}
          </span>
          <button
            onClick={copyAddress}
            aria-label={copied ? "Address copied" : "Copy address"}
            className="text-gray-500 hover:text-indigo-400 transition"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-gray-300 max-w-lg">{profile.bio}</p>
        )}

        {/* Social links */}
        {profile.socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            {profile.socialLinks.map((url) => {
              const platform = detectPlatform(url);
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-400 transition"
                >
                  <PlatformIcon platform={platform} />
                  {platform ?? new URL(url).hostname}
                </a>
              );
            })}
          </div>
        )}

        {/* Edit button */}
        {isOwner && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition"
          >
            <Edit2 size={13} />
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}
