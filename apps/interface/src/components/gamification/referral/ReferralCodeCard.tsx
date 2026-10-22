"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Copy } from "lucide-react";

export function ReferralCodeCard({
  code,
  onCopy,
}: {
  code: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-6 shadow-lg"
    >
      <p className="text-sm opacity-90 mb-3">Your Referral Code</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 font-mono text-2xl font-bold tracking-widest">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition"
          title="Copy referral code"
        >
          {copied ? (
            <CheckCircle size={20} className="text-green-300" />
          ) : (
            <Copy size={20} />
          )}
        </button>
      </div>
    </motion.div>
  );
}
