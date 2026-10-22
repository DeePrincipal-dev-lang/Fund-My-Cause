"use client";

import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { Comment } from "@/types/comment";
import { sanitizeComment } from "@/lib/sanitize";
import { useWallet } from "@/hooks/useWallet";
import { CommentItem } from "./comment/CommentItem";
import { ModerationQueue } from "./comment/ModerationQueue";

interface Props {
  campaignId: string;
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onVote: (commentId: string, type: "up" | "down") => Promise<void>;
  onFlag: (commentId: string, reason?: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onModerate?: (
    commentId: string,
    action: "approve" | "reject",
  ) => Promise<void>;
  isCreator: boolean;
  pendingComments?: Comment[];
}

export function CommentSection({
  campaignId: _campaignId,
  comments,
  onAddComment,
  onVote,
  onFlag,
  onDelete,
  onModerate,
  isCreator,
  pendingComments,
}: Props) {
  const { address } = useWallet();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topLevelComments = comments.filter((c) => !c.parentId && !c.isDeleted);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(sanitizeComment(newComment.trim()));
      setNewComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!address) {
    return (
      <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Connect your wallet to join the discussion
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={20} className="text-gray-600 dark:text-gray-400" />
        <h3
          id="comments-heading"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          Discussion ({comments.filter((c) => !c.isDeleted).length})
        </h3>
        {isCreator && pendingComments && pendingComments.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            {pendingComments.length} pending
          </span>
        )}
      </div>

      {isCreator && pendingComments && pendingComments.length > 0 && (
        <ModerationQueue
          pendingComments={pendingComments}
          onModerate={onModerate}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none"
          rows={3}
          maxLength={1000}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {newComment.length}/1000
          </span>
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            <Send size={14} />
            Post Comment
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {topLevelComments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          topLevelComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              allComments={comments}
              currentAddress={address}
              isCreator={isCreator}
              onVote={onVote}
              onFlag={onFlag}
              onDelete={onDelete}
              onAddComment={onAddComment}
            />
          ))
        )}
      </div>
    </section>
  );
}
