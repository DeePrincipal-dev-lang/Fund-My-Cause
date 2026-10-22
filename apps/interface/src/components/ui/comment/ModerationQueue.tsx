"use client";

import React from "react";
import type { Comment } from "@/types/comment";
import { formatAddress } from "@/lib/format";

interface ModerationQueueProps {
  pendingComments: Comment[];
  onModerate?: (
    commentId: string,
    action: "approve" | "reject",
  ) => Promise<void>;
}

export function ModerationQueue({
  pendingComments,
  onModerate,
}: ModerationQueueProps) {
  if (!pendingComments || pendingComments.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
        Moderation Queue ({pendingComments.length})
      </h4>
      {pendingComments.map((pc) => (
        <div
          key={pc.id}
          className="flex items-start gap-2 py-2 border-b border-amber-200 dark:border-amber-800 last:border-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{formatAddress(pc.author)}</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
              {pc.content}
            </p>
            {pc.flagReason && (
              <p className="text-xs text-red-500 mt-1">
                Reason: {pc.flagReason}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onModerate?.(pc.id, "approve")}
              className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-medium"
            >
              Approve
            </button>
            <button
              onClick={() => onModerate?.(pc.id, "reject")}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
