"use client";

import React, { useState } from "react";
import {
  Flag,
  Reply,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type { Comment } from "@/types/comment";
import { formatAddress } from "@/lib/format";
import { sanitizeComment } from "@/lib/sanitize";

interface CommentItemProps {
  comment: Comment;
  allComments: Comment[];
  currentAddress?: string;
  isCreator: boolean;
  isReply?: boolean;
  onVote: (commentId: string, type: "up" | "down") => Promise<void>;
  onFlag: (commentId: string, reason?: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onAddComment: (content: string, parentId?: string) => Promise<void>;
}

export function CommentItem({
  comment,
  allComments,
  currentAddress,
  isCreator,
  isReply = false,
  onVote,
  onFlag,
  onDelete,
  onAddComment,
}: CommentItemProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const replies = allComments.filter(
    (c) => c.parentId === comment.id && !c.isDeleted,
  );
  const isAuthor = currentAddress === comment.author;
  const score = comment.upvotes - comment.downvotes;

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(sanitizeComment(replyContent.trim()), parentId);
      setReplyContent("");
      setReplyTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlag = async (commentId: string) => {
    if (flagReason.trim()) {
      await onFlag(commentId, flagReason.trim());
    } else {
      await onFlag(commentId);
    }
    setFlaggingId(null);
    setFlagReason("");
  };

  return (
    <div className={`${isReply ? "ml-8 mt-2" : ""}`}>
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onVote(comment.id, "up")}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Upvote"
            >
              <ThumbsUp
                size={14}
                className="text-gray-500 dark:text-gray-400"
              />
            </button>
            <span
              className={`text-xs font-medium ${
                score > 0
                  ? "text-green-600 dark:text-green-400"
                  : score < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {score}
            </span>
            <button
              onClick={() => onVote(comment.id, "down")}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Downvote"
            >
              <ThumbsDown
                size={14}
                className="text-gray-500 dark:text-gray-400"
              />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono">
                {formatAddress(comment.author)}
              </span>
              {isAuthor && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold">
                  You
                </span>
              )}
              {comment.isFlagged && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold">
                  Flagged
                </span>
              )}
              <span>•</span>
              <span>{new Date(comment.timestamp).toLocaleDateString()}</span>
            </div>

            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
              {comment.content}
            </p>

            <div className="flex items-center gap-3 text-xs">
              {!isReply && (
                <button
                  onClick={() => setReplyTo(comment.id)}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  <Reply size={12} />
                  Reply
                </button>
              )}
              <button
                onClick={() => setFlaggingId(comment.id)}
                className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
              >
                <Flag size={12} />
                Flag
              </button>
              {(isCreator || isAuthor) && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>

            {flaggingId === comment.id && (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Reason for flagging (optional)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  maxLength={200}
                />
                <button
                  onClick={() => handleFlag(comment.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition"
                >
                  Report
                </button>
                <button
                  onClick={() => {
                    setFlaggingId(null);
                    setFlagReason("");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {replyTo === comment.id && (
        <div className="ml-8 mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              maxLength={500}
            />
            <button
              onClick={() => handleReply(comment.id)}
              disabled={!replyContent.trim() || isSubmitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
            >
              Reply
            </button>
            <button
              onClick={() => {
                setReplyTo(null);
                setReplyContent("");
              }}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="space-y-2 mt-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              allComments={allComments}
              currentAddress={currentAddress}
              isCreator={isCreator}
              isReply
              onVote={onVote}
              onFlag={onFlag}
              onDelete={onDelete}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
