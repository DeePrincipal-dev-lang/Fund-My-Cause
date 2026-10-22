"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, Mail, QrCode } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { getCampaignSlug } from "@/lib/slugs";

interface ShareModalProps {
  campaignId: string;
  campaignTitle: string;
  onClose: () => void;
}

// Minimal QR code via a free API (no library needed)
function QRCode({ url }: { url: string }) {
  const encoded = encodeURIComponent(url);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encoded}`}
      alt="QR code for campaign URL"
      width={160}
      height={160}
      className="rounded-xl mx-auto"
    />
  );
}

const PLATFORMS = [
  {
    id: "twitter",
    label: "X (Twitter)",
    color: "bg-black hover:bg-gray-900",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" on Fund-My-Cause! ${url}`)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "bg-[#1877F2] hover:bg-[#166fe5]",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "bg-[#0A66C2] hover:bg-[#0958a8]",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    getUrl: (url: string, title: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    color: "bg-[#FF4500] hover:bg-[#e03d00]",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
    getUrl: (url: string, title: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
];

export function ShareModal({ campaignId, campaignTitle, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trapRef = useFocusTrap(true, { onEscape: onClose }) as React.RefObject<HTMLDivElement>;

  const slug = getCampaignSlug(campaignId);
  const campaignUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/campaigns/${slug}`
      : `/campaigns/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(campaignUrl);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Check out: ${campaignTitle}`);
    const body = encodeURIComponent(`I thought you might be interested in this campaign on Fund-My-Cause:\n\n${campaignTitle}\n${campaignUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={handleBackdrop}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="share-modal-title" className="font-semibold text-gray-900 dark:text-white">Share Campaign</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Copy link */}
        <div className="flex gap-2">
          <input
            readOnly
            value={campaignUrl}
            className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-300 truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-sm font-medium transition shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Social platforms */}
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => window.open(p.getUrl(campaignUrl, campaignTitle), "_blank", "noopener,noreferrer")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white transition ${p.color}`}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* Email + QR */}
        <div className="flex gap-2">
          <button
            onClick={handleEmail}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm font-medium transition"
          >
            <Mail size={14} /> Email
          </button>
          <button
            onClick={() => setShowQr((v) => !v)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm font-medium transition"
          >
            <QrCode size={14} /> QR Code
          </button>
        </div>

        {showQr && (
          <div className="pt-2">
            <QRCode url={campaignUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
