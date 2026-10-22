"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle, TrendingUp, Users, Wallet } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WalletGuard } from "@/components/WalletGuard";
import {
  EmptyState,
  NoDashboardCampaignsIllustration,
} from "@/components/ui/EmptyState";
import { DeadlineExtensionModal } from "@/components/ui/DeadlineExtensionModal";
import { CancelCampaignModal } from "@/components/ui/CancelCampaignModal";
import { useWallet } from "@/hooks/useWallet";
import { useNotifications } from "@/hooks/useNotifications";
import { useCampaign } from "@/hooks/useCampaign";
import type { CampaignStatus } from "@/types/soroban";
import {
  buildWithdrawTx,
  buildCancelTx,
  buildPauseTx,
  buildUnpauseTx,
  buildUpdateMetadataTx,
  submitSignedTx,
} from "@/lib/soroban";

const REGISTRY_KEY = "fmc:campaigns";
const CONTRIBUTIONS_KEY = "fmc:contributions";

function getContractIds(address: string): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const map: Record<string, string[]> = JSON.parse(raw);
    return map[address] ?? [];
  } catch {
    return [];
  }
}

function getContributedIds(address: string): string[] {
  try {
    const raw = localStorage.getItem(CONTRIBUTIONS_KEY);
    if (!raw) return [];
    const map: Record<string, string[]> = JSON.parse(raw);
    return map[address] ?? [];
  } catch {
    return [];
  }
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  Active: "bg-indigo-900 text-indigo-300",
  Successful: "bg-green-900 text-green-300",
  Refunded: "bg-yellow-900 text-yellow-300",
  Cancelled: "bg-red-900 text-red-300",
  Paused: "bg-slate-800 text-slate-300",
  Archived: "bg-slate-800 text-slate-400",
};

const STATUS_ICONS: Record<CampaignStatus, string> = {
  Active: "●",
  Successful: "✓",
  Refunded: "↩",
  Cancelled: "✗",
  Paused: "⏸",
  Archived: "▫",
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span aria-hidden="true">{STATUS_ICONS[status]}</span>
      {status}
    </span>
  );
}

type EditableCampaign = {
  contractId: string;
  title: string;
  description: string;
};

function EditModal({
  campaign,
  onClose,
  onSave,
}: {
  campaign: EditableCampaign;
  onClose: () => void;
  onSave: (
    contractId: string,
    title: string,
    description: string,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState(campaign.description);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const triggerRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      (triggerRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const save = async () => {
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave(campaign.contractId, title, description);
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        className="w-full max-w-md space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6"
      >
        <h2 id="edit-modal-title" className="text-lg font-semibold">
          Edit Metadata
        </h2>
        <div>
          <label
            htmlFor="edit-title"
            className="mb-1 block text-sm text-gray-400"
          >
            Title
          </label>
          <input
            id="edit-title"
            className={inputCls}
            value={title}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(event.target.value)
            }
          />
        </div>
        <div>
          <label
            htmlFor="edit-description"
            className="mb-1 block text-sm text-gray-400"
          >
            Description
          </label>
          <textarea
            id="edit-description"
            rows={3}
            className={inputCls}
            value={description}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(event.target.value)
            }
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardCampaignCard({
  contractId,
  actionPending,
  onAction,
  onCancel,
  onPauseToggle,
  onEdit,
  onExtend,
  refreshNonce,
}: {
  contractId: string;
  actionPending: string | null;
  onAction: (
    contractId: string,
    action: "withdraw" | "cancel",
  ) => Promise<void>;
  onCancel: (contractId: string, title: string) => void;
  onPauseToggle: (
    contractId: string,
    currentlyPaused: boolean,
  ) => Promise<void>;
  onEdit: (campaign: EditableCampaign) => void;
  onExtend: (contractId: string, currentDeadline: string) => void;
  refreshNonce: number;
}) {
  const { info, stats, loading, refresh } = useCampaign(contractId);

  useEffect(() => {
    if (refreshNonce > 0) refresh();
  }, [refreshNonce, refresh]);

  if (loading || !info || !stats) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
        <Loader2 size={20} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const fmtXlm = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const raisedXlm = Number(stats.totalRaised) / 1e7;
  const goalXlm = Number(stats.goal) / 1e7;
  const progress = goalXlm > 0 ? Math.min(100, (raisedXlm / goalXlm) * 100) : 0;
  const deadline = new Date(Number(info.deadline) * 1000).toLocaleDateString();
  const isExpired = Number(info.deadline) * 1000 < Date.now();

  const canWithdraw =
    info.status === "Successful" || (isExpired && raisedXlm >= goalXlm);
  const canCancel = info.status === "Active";
  const canPause = info.status === "Active";
  const canUnpause = info.status === "Paused";
  const canEdit = info.status === "Active";
  const isPending = (action: string) =>
    actionPending === `${contractId}:${action}`;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight">{info.title}</h2>
        <StatusBadge status={info.status} />
      </div>
      <ProgressBar progress={progress} />
      <div className="flex justify-between text-sm text-gray-400">
        <span>{fmtXlm(raisedXlm)} XLM raised</span>
        <span>Goal: {fmtXlm(goalXlm)} XLM</span>
      </div>
      <p className="text-xs text-gray-500">Deadline: {deadline}</p>
      <p className="truncate font-mono text-xs text-gray-600">{contractId}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {canWithdraw && (
          <button
            onClick={() => onAction(contractId, "withdraw")}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium transition hover:bg-green-600 disabled:opacity-50"
          >
            {isPending("withdraw") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Withdraw
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => onCancel(contractId, info.title)}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending("cancel") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Cancel
          </button>
        )}
        {canPause && (
          <button
            onClick={() => onPauseToggle(contractId, false)}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-600 disabled:opacity-50"
          >
            {isPending("pause") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Pause
          </button>
        )}
        {canUnpause && (
          <button
            onClick={() => onPauseToggle(contractId, true)}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-medium transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {isPending("unpause") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Resume
          </button>
        )}
        {canEdit && (
          <button
            onClick={() =>
              onEdit({
                contractId,
                title: info.title,
                description: info.description,
              })
            }
            disabled={!!actionPending}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-600 disabled:opacity-50"
          >
            Edit Metadata
          </button>
        )}
        {canEdit && (
          <button
            onClick={() =>
              onExtend(
                contractId,
                new Date(Number(info.deadline) * 1000).toISOString(),
              )
            }
            disabled={!!actionPending}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-600 disabled:opacity-50"
          >
            Extend Deadline
          </button>
        )}
      </div>
    </div>
  );
}

function ContributedCampaignCard({ contractId }: { contractId: string }) {
  const { info, stats, loading } = useCampaign(contractId);
  const router = useRouter();

  if (loading || !info || !stats) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
        <Loader2 size={20} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const raisedXlm = Number(stats.totalRaised) / 1e7;
  const goalXlm = Number(stats.goal) / 1e7;
  const progress = goalXlm > 0 ? Math.min(100, (raisedXlm / goalXlm) * 100) : 0;

  return (
    <div
      className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5 cursor-pointer hover:border-gray-600 transition"
      onClick={() => router.push(`/campaigns/${contractId}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) =>
        e.key === "Enter" && router.push(`/campaigns/${contractId}`)
      }
      aria-label={`View campaign: ${info.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-tight">{info.title}</h3>
        <StatusBadge status={info.status} />
      </div>
      <ProgressBar progress={progress} />
      <div className="flex justify-between text-sm text-gray-400">
        <span>
          {raisedXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          XLM raised
        </span>
        <span>
          Goal:{" "}
          {goalXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
        </span>
      </div>
      <p className="truncate font-mono text-xs text-gray-600">{contractId}</p>
    </div>
  );
}

function DashboardStats({
  createdIds,
  contributedIds,
}: {
  createdIds: string[];
  contributedIds: string[];
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8"
      data-testid="dashboard-stats"
    >
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex items-center gap-4">
        <div className="rounded-xl bg-indigo-900/50 p-3">
          <TrendingUp size={20} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{createdIds.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Campaigns Created</p>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex items-center gap-4">
        <div className="rounded-xl bg-green-900/50 p-3">
          <Wallet size={20} className="text-green-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{contributedIds.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Campaigns Backed</p>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex items-center gap-4">
        <div className="rounded-xl bg-purple-900/50 p-3">
          <Users size={20} className="text-purple-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">
            {createdIds.length + contributedIds.length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total Campaigns</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, signTx, networkMismatch } = useWallet();
  const { addNotification } = useNotifications();
  const router = useRouter();

  const [contractIds, setContractIds] = useState<string[]>([]);
  const [contributedIds, setContributedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditableCampaign | null>(null);
  const [extendTarget, setExtendTarget] = useState<{
    contractId: string;
    currentDeadline: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    contractId: string;
    title: string;
  } | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const loadCampaignIds = useCallback((walletAddress: string) => {
    setLoading(true);
    setLoadError(null);

    try {
      setContractIds(getContractIds(walletAddress));
      setContributedIds(getContributedIds(walletAddress));
    } catch {
      setContractIds([]);
      setContributedIds([]);
      setLoadError("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setContractIds([]);
      setContributedIds([]);
      return;
    }

    loadCampaignIds(address);
  }, [address, loadCampaignIds]);

  const handleAction = async (
    contractId: string,
    action: "withdraw" | "cancel",
    reason?: string,
  ) => {
    setActionPending(`${contractId}:${action}`);
    try {
      const xdr =
        action === "withdraw"
          ? await buildWithdrawTx(address!, contractId)
          : await buildCancelTx(address!, contractId, reason);
      const signed = await signTx(xdr);
      await submitSignedTx(signed);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setActionPending(null);
    }
  };

  const handlePauseToggle = async (
    contractId: string,
    currentlyPaused: boolean,
  ) => {
    const action = currentlyPaused ? "unpause" : "pause";

    let reason: string | undefined;
    if (!currentlyPaused) {
      const input = window.prompt("Reason for pausing (optional):");
      if (input === null) return; // user cancelled
      reason = input.trim() || undefined;
    }

    setActionPending(`${contractId}:${action}`);
    try {
      const xdr = currentlyPaused
        ? await buildUnpauseTx(address!, contractId)
        : await buildPauseTx(address!, contractId);
      const signed = await signTx(xdr);
      await submitSignedTx(signed);

      if (currentlyPaused) {
        localStorage.removeItem(`fmc:pause_reason:${contractId}`);
      } else if (reason) {
        localStorage.setItem(`fmc:pause_reason:${contractId}`, reason);
      }

      addNotification({
        type: "info",
        title: currentlyPaused ? "Campaign Resumed" : "Campaign Paused",
        message: currentlyPaused
          ? "The campaign has been resumed and is accepting contributions again."
          : `The campaign has been paused.${reason ? ` Reason: ${reason}` : ""}`,
        campaignId: contractId,
      });
      setRefreshNonce((n) => n + 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setActionPending(null);
    }
  };

  const handleEdit = async (
    contractId: string,
    title: string,
    description: string,
  ) => {
    const xdr = await buildUpdateMetadataTx(
      address!,
      contractId,
      title,
      description,
    );
    const signed = await signTx(xdr);
    await submitSignedTx(signed);
    setRefreshNonce((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <WalletGuard message="Connect your wallet to view your dashboard.">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">My Dashboard</h1>
            <button
              onClick={() => router.push("/create")}
              disabled={networkMismatch}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <PlusCircle size={16} /> New Campaign
            </button>
          </div>

          {loadError && (
            <p className="mb-6 text-sm text-red-400" role="alert">
              {loadError}
            </p>
          )}

          {/* Statistics */}
          {(contractIds.length > 0 || contributedIds.length > 0) && (
            <DashboardStats
              createdIds={contractIds}
              contributedIds={contributedIds}
            />
          )}

          {/* Created campaigns */}
          <section
            aria-labelledby="created-campaigns-heading"
            className="mb-10"
          >
            <h2
              id="created-campaigns-heading"
              className="text-xl font-semibold mb-4"
            >
              My Campaigns
            </h2>

            {!loading && contractIds.length === 0 && (
              <EmptyState
                illustration={<NoDashboardCampaignsIllustration />}
                title="No campaigns yet"
                description="You haven't created any campaigns. Launch your first one and start raising funds on Stellar."
                action={{
                  label: "Create Campaign",
                  onClick: () => router.push("/create"),
                }}
              />
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {contractIds.map((contractId) => (
                <DashboardCampaignCard
                  key={contractId}
                  contractId={contractId}
                  onAction={handleAction}
                  onCancel={(id, title) =>
                    setCancelTarget({ contractId: id, title })
                  }
                  onPauseToggle={handlePauseToggle}
                  onEdit={setEditTarget}
                  onExtend={(id, deadline) =>
                    setExtendTarget({
                      contractId: id,
                      currentDeadline: deadline,
                    })
                  }
                  actionPending={actionPending}
                  refreshNonce={refreshNonce}
                />
              ))}
            </div>
          </section>

          {/* Contributed campaigns */}
          <section aria-labelledby="contributed-campaigns-heading">
            <h2
              id="contributed-campaigns-heading"
              className="text-xl font-semibold mb-4"
            >
              Campaigns I&apos;ve Backed
            </h2>

            {!loading && contributedIds.length === 0 && (
              <p className="text-sm text-gray-500">
                You haven&apos;t backed any campaigns yet.{" "}
                <button
                  onClick={() => router.push("/campaigns")}
                  className="text-indigo-400 hover:underline"
                >
                  Explore campaigns
                </button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {contributedIds.map((contractId) => (
                <ContributedCampaignCard
                  key={contractId}
                  contractId={contractId}
                />
              ))}
            </div>
          </section>
        </div>

        {editTarget && (
          <EditModal
            campaign={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={handleEdit}
          />
        )}
        {extendTarget && (
          <DeadlineExtensionModal
            contractId={extendTarget.contractId}
            currentDeadline={extendTarget.currentDeadline}
            onClose={() => setExtendTarget(null)}
            onExtend={async (_contractId, _newTs) => {
              setExtendTarget(null);
              setRefreshNonce((n) => n + 1);
            }}
          />
        )}
        {cancelTarget && (
          <CancelCampaignModal
            campaignTitle={cancelTarget.title}
            onClose={() => setCancelTarget(null)}
            onConfirm={async (reason) => {
              await handleAction(cancelTarget.contractId, "cancel", reason);
              setCancelTarget(null);
            }}
          />
        )}
      </WalletGuard>
    </main>
  );
}
