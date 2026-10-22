"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Edit2, Loader2, Trash2, AlertCircle } from "lucide-react";
import { getCids, fetchUpdate, deleteUpdate } from "@/lib/updateStore";
import type { Update } from "@/lib/updateStore";
import { PostUpdateModal } from "@/components/ui/PostUpdateModal";

// ── Relative time helper ─────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

// ── UpdateCard ───────────────────────────────────────────────────────────────

interface ResolvedUpdate {
  cid: string;
  update: Update | null;
  error: boolean;
}

interface UpdateCardProps {
  resolved: ResolvedUpdate;
  connectedAddress?: string;
  campaignId: string;
  onEdit: (cid: string, update: Update) => void;
  onDeleted: (cid: string) => void;
}

function UpdateCard({
  resolved,
  connectedAddress,
  campaignId,
  onEdit,
  onDeleted,
}: UpdateCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (resolved.error || !resolved.update) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 flex items-center gap-2">
        <AlertCircle size={14} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-300">Failed to load this update.</p>
      </div>
    );
  }

  const { update } = resolved;
  const isAuthor =
    !!connectedAddress && connectedAddress === update.authorAddress;

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      deleteUpdate(campaignId, resolved.cid);
      onDeleted(resolved.cid);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-white leading-tight">
          {update.title}
        </h3>
        {isAuthor && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(resolved.cid, update)}
              aria-label="Edit update"
              className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-gray-800 transition"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label={confirmDelete ? "Confirm delete" : "Delete update"}
              className={`p-1.5 rounded-lg transition ${
                confirmDelete
                  ? "text-red-400 hover:bg-red-950/40"
                  : "text-gray-500 hover:text-red-400 hover:bg-gray-800"
              } disabled:opacity-40`}
            >
              {deleting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {update.body}
      </p>

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{timeAgo(update.createdAt)}</span>
        {update.editedAt && (
          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
            Edited
          </span>
        )}
      </div>

      {/* Confirm delete prompt */}
      {confirmDelete && !deleting && (
        <p className="text-xs text-red-400">
          Click Delete again to confirm.{" "}
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-gray-400 underline hover:text-white"
          >
            Cancel
          </button>
        </p>
      )}

      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
    </div>
  );
}

// ── UpdateFeed ───────────────────────────────────────────────────────────────

export interface UpdateFeedProps {
  campaignId: string;
  campaignTitle?: string;
  connectedAddress?: string;
}

/**
 * Fetches and renders all campaign updates in reverse-chronological order.
 * Shows loading skeleton, empty state, and per-item error placeholders.
 */
export function UpdateFeed({
  campaignId,
  campaignTitle = "",
  connectedAddress,
}: UpdateFeedProps) {
  const [resolvedUpdates, setResolvedUpdates] = useState<ResolvedUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<{
    cid: string;
    update: Update;
  } | null>(null);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    const cids = getCids(campaignId);

    if (cids.length === 0) {
      setResolvedUpdates([]);
      setLoading(false);
      return;
    }

    const results = await Promise.allSettled(
      cids.map((cid) => fetchUpdate(cid)),
    );

    const resolved: ResolvedUpdate[] = results.map((result, i) => {
      if (result.status === "fulfilled") {
        return { cid: cids[i], update: result.value, error: false };
      }
      return { cid: cids[i], update: null, error: true };
    });

    // Sort resolved (non-error) updates by createdAt descending, errors last
    resolved.sort((a, b) => {
      if (!a.update && !b.update) return 0;
      if (!a.update) return 1;
      if (!b.update) return -1;
      return b.update.createdAt - a.update.createdAt;
    });

    setResolvedUpdates(resolved);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const handleDeleted = useCallback((cid: string) => {
    setResolvedUpdates((prev) => prev.filter((r) => r.cid !== cid));
  }, []);

  const handleEditSuccess = useCallback(
    (_newCid: string) => {
      setEditTarget(null);
      loadUpdates();
    },
    [loadUpdates],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="updates-heading" className="space-y-4">
      <h2 id="updates-heading" className="text-lg font-semibold">
        Campaign Updates
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-gray-800 bg-gray-900 animate-pulse"
            />
          ))}
        </div>
      ) : resolvedUpdates.length === 0 ? (
        <p className="text-sm text-gray-500">No updates yet.</p>
      ) : (
        <div className="space-y-4">
          {resolvedUpdates.map((resolved) => (
            <UpdateCard
              key={resolved.cid}
              resolved={resolved}
              connectedAddress={connectedAddress}
              campaignId={campaignId}
              onEdit={(cid, update) => setEditTarget({ cid, update })}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {editTarget && (
        <PostUpdateModal
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          authorAddress={connectedAddress ?? ""}
          existingCid={editTarget.cid}
          existingUpdate={editTarget.update}
          onClose={() => setEditTarget(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </section>
  );
}
