import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Comment, CommentInput } from "@/types/comment";
import { QUERY_KEYS } from "@/lib/queryKeys";

// Mock storage - in production, this would use IPFS or on-chain storage
const COMMENTS_STORAGE_KEY = "campaign_comments";
const MODERATION_STORAGE_KEY = "moderation_queue";

// ─── Rate limiting ──────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const MAX_COMMENTS_PER_WINDOW = 5;
const SPAM_LINK_THRESHOLD = 3;

interface WalletRateState {
  timestamps: number[];
  contentHashes: string[];
}

const rateLimitMap = new Map<string, WalletRateState>();

function checkRateLimit(address: string, content: string): void {
  const now = Date.now();
  let state = rateLimitMap.get(address);

  if (!state) {
    state = { timestamps: [], contentHashes: [] };
    rateLimitMap.set(address, state);
  }

  // Purge old entries outside window
  state.timestamps = state.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  state.contentHashes = state.contentHashes.filter((_, i) => now - state.timestamps[i] < RATE_LIMIT_WINDOW);

  // Check frequency
  if (state.timestamps.length >= MAX_COMMENTS_PER_WINDOW) {
    const oldest = state.timestamps[0];
    const waitMs = RATE_LIMIT_WINDOW - (now - oldest);
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitMs / 1000)}s before posting again.`);
  }

  // Check duplicate content
  const contentHash = content.slice(0, 100).toLowerCase().replace(/\s+/g, " ");
  if (state.contentHashes.includes(contentHash)) {
    throw new Error("Duplicate comment detected. Please revise your message.");
  }

  state.timestamps.push(now);
  state.contentHashes.push(contentHash);
}

// ─── Spam heuristics ────────────────────────────────────────────────────────

const SPAM_PATTERNS = [
  /\b(buy now|click here|free money|earn fast|limited offer|act now)\b/i,
  /(https?:\/\/[^\s]+){3,}/, // 3+ URLs
  /(?:^|\s)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:\s|$)/i, // email addresses
  /(?:[\p{Sc}])/gu, // currency symbols
  /(.)\1{20,}/, // repeated characters (spammy)
];

function checkSpamHeuristics(content: string): { isSpam: boolean; reason?: string } {
  const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;

  if (linkCount >= SPAM_LINK_THRESHOLD) {
    return { isSpam: true, reason: "Excessive links" };
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      return { isSpam: true, reason: `Matched spam pattern: ${pattern}` };
    }
  }

  return { isSpam: false };
}

// ─── Moderation queue ───────────────────────────────────────────────────────

function getModerationQueue(): Comment[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(MODERATION_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function addToModerationQueue(comment: Comment): void {
  const queue = getModerationQueue();
  queue.push(comment);
  if (typeof window !== "undefined") {
    localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(queue));
  }
}

function removeFromModerationQueue(commentId: string): void {
  const queue = getModerationQueue().filter((c) => c.id !== commentId);
  if (typeof window !== "undefined") {
    localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(queue));
  }
}

// ─── Comment storage helpers ────────────────────────────────────────────────

function getStoredComments(): Comment[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveComments(comments: Comment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
}

export function useComments(campaignId: string, userAddress: string | null) {
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: QUERY_KEYS.comments(campaignId),
    queryFn: () => {
      const allComments = getStoredComments();
      return allComments.filter(
        (c) => c.campaignId === campaignId && c.moderationStatus !== "rejected"
      );
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentId }: CommentInput) => {
      if (!userAddress) throw new Error("Wallet not connected");

      // Rate limit check
      checkRateLimit(userAddress, content);

      // Spam heuristics
      const spamCheck = checkSpamHeuristics(content);

      const allComments = getStoredComments();
      const newComment: Comment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        campaignId,
        author: userAddress,
        content,
        timestamp: Date.now(),
        upvotes: 0,
        downvotes: 0,
        parentId,
        isDeleted: false,
        isFlagged: false,
        moderationStatus: spamCheck.isSpam ? "pending" : "approved",
      };

      allComments.push(newComment);
      saveComments(allComments);

      if (spamCheck.isSpam) {
        newComment.flagReason = spamCheck.reason;
        newComment.flagTimestamp = Date.now();
        addToModerationQueue(newComment);
      }

      return newComment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(campaignId) });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ commentId, type }: { commentId: string; type: "up" | "down" }) => {
      const allComments = getStoredComments();
      const comment = allComments.find(c => c.id === commentId);
      if (!comment) throw new Error("Comment not found");

      if (type === "up") {
        comment.upvotes += 1;
      } else {
        comment.downvotes += 1;
      }

      saveComments(allComments);
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(campaignId) });
    },
  });

  const flagMutation = useMutation({
    mutationFn: async ({ commentId, reason }: { commentId: string; reason?: string }) => {
      const allComments = getStoredComments();
      const comment = allComments.find(c => c.id === commentId);
      if (!comment) throw new Error("Comment not found");

      comment.isFlagged = true;
      comment.flagReason = reason || "User reported";
      comment.flagTimestamp = Date.now();
      comment.moderationStatus = "pending";
      saveComments(allComments);

      addToModerationQueue(comment);
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(campaignId) });
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async ({
      commentId,
      action,
      moderator: _moderator,
    }: {
      commentId: string;
      action: "approve" | "reject";
      moderator?: string;
      timestamp?: number;
    }) => {
      const allComments = getStoredComments();
      const comment = allComments.find((c) => c.id === commentId);
      if (!comment) throw new Error("Comment not found");

      if (action === "approve") {
        comment.moderationStatus = "approved";
        comment.isFlagged = false;
        comment.flagReason = undefined;
      } else {
        comment.moderationStatus = "rejected";
      }

      saveComments(allComments);
      removeFromModerationQueue(commentId);
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(campaignId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const allComments = getStoredComments();
      const comment = allComments.find(c => c.id === commentId);
      if (!comment) throw new Error("Comment not found");

      comment.isDeleted = true;
      comment.content = "[deleted]";
      saveComments(allComments);
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(campaignId) });
    },
  });

  const addComment = useCallback(
    async (content: string, parentId?: string) => {
      await addCommentMutation.mutateAsync({ content, parentId });
    },
    [addCommentMutation]
  );

  const vote = useCallback(
    async (commentId: string, type: "up" | "down") => {
      await voteMutation.mutateAsync({ commentId, type });
    },
    [voteMutation]
  );

  const flag = useCallback(
    async (commentId: string, reason?: string) => {
      await flagMutation.mutateAsync({ commentId, reason });
    },
    [flagMutation]
  );

  const moderate = useCallback(
    async (commentId: string, action: "approve" | "reject") => {
      await moderateMutation.mutateAsync({
        commentId,
        action,
        moderator: userAddress || "unknown",
        timestamp: Date.now(),
      });
    },
    [moderateMutation, userAddress]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await deleteMutation.mutateAsync(commentId);
    },
    [deleteMutation]
  );

  return {
    comments,
    isLoading,
    addComment,
    vote,
    flag,
    moderate,
    deleteComment,
  };
}
