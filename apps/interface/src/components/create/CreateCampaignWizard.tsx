"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { WalletGuard } from "@/components/WalletGuard";
import { useWallet } from "@/hooks/useWallet";
import { buildInitializeTx, submitSignedTx } from "@/lib/soroban";
import { sanitizeTitle, sanitizeDescription } from "@/lib/validation";
import { DraftIndicator } from "@/components/ui/DraftIndicator";
import { CampaignPreview } from "@/components/ui/CampaignPreview";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { CampaignPreviewModal } from "@/components/ui/CampaignPreviewModal";
import { BackButton } from "@/components/ui/BackButton";
import { saveCampaignMeta } from "@/lib/categories";
import { useWizardState } from "./wizard/useWizardState";
import {
  STEPS,
  STEP,
  LAST_FORM_STEP,
  type TxStatus,
} from "./wizard/types";
import { BasicInfoStep } from "./wizard/steps/BasicInfoStep";
import { MediaStep } from "./wizard/steps/MediaStep";
import { FaqTeamStep } from "./wizard/steps/FaqTeamStep";
import { PlatformConfigStep } from "./wizard/steps/PlatformConfigStep";
import { ReviewStep } from "./wizard/steps/ReviewStep";
import { WizardProgressHeader } from "./wizard/WizardProgressHeader";
import { ResumeDraftBanner } from "./wizard/ResumeDraftBanner";

export { INITIAL, STEPS, PREVIEW_STEP } from "./wizard/types";
export type { CampaignFormData } from "./wizard/types";
export { validateStep, validateAllSteps } from "./wizard/validators";

const STROOPS_PER_XLM = 10_000_000;

export function CreateCampaignWizard() {
  const { address, signTx, networkMismatch } = useWallet();
  const router = useRouter();

  const {
    step,
    data,
    validationError,
    showPreview,
    set,
    setFaqs,
    setTeamMembers,
    next,
    back,
    restore,
    validateForSubmission,
    draft,
  } = useWizardState();

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(true);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const {
    hasDraft,
    loadDraft,
    saveDraft,
    clearDraft,
    saveStatus,
    lastSaved,
    resolveConflict,
  } = draft;

  const handleResumeDraft = () => {
    const saved = loadDraft();
    if (!saved) return;
    const { step: savedStep, ...formFields } = saved;
    restore(formFields, savedStep);
    setShowResumeBanner(false);
  };

  const handleDismissDraft = () => {
    clearDraft();
    setShowResumeBanner(false);
  };

  const handleManualSave = () => {
    saveDraft({ ...data, step });
  };

  const deploy = async () => {
    if (validateForSubmission()) return;

    setTxStatus("pending");
    setTxError(null);
    try {
      const deadlineTs = BigInt(
        Math.floor(new Date(data.deadline).getTime() / 1000),
      );
      const xlmToStroops = (xlm: string) =>
        BigInt(Math.round(Number(xlm) * STROOPS_PER_XLM));

      const xdr = await buildInitializeTx({
        contractId: data.contractId,
        creator: address!,
        token: data.token,
        goal: xlmToStroops(data.goal),
        deadline: deadlineTs,
        minContribution: xlmToStroops(data.minContribution || "1"),
        title: sanitizeTitle(data.title),
        description: sanitizeDescription(data.description),
        socialLinks: data.imageUrl ? [data.imageUrl] : undefined,
        platformFeeAddress: data.feeAddress || undefined,
        platformFeeBps: data.feeBps ? Number(data.feeBps) : undefined,
      });

      const signed = await signTx(xdr);
      const hash = await submitSignedTx(signed);
      try {
        const raw = localStorage.getItem("fmc:campaigns");
        const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
        map[address!] = [
          ...new Set([...(map[address!] ?? []), data.contractId]),
        ];
        localStorage.setItem("fmc:campaigns", JSON.stringify(map));
      } catch {}

      clearDraft();
      setTxHash(hash);
      setTxStatus("success");
      if (data.category) {
        saveCampaignMeta(data.contractId, { category: data.category });
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Transaction failed.");
      setTxStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />
      <WalletGuard message="Connect your wallet to create a campaign.">
        {txStatus === "success" ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-6">
            <CheckCircle2
              size={48}
              className="text-green-500 dark:text-green-400"
            />
            <h2 className="text-2xl font-bold">Campaign Deployed!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm break-all">
              Tx: {txHash}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl transition text-white"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <div
            className={
              showPreview
                ? "max-w-4xl mx-auto px-6 py-12"
                : "max-w-xl mx-auto px-6 py-12"
            }
          >
            <BackButton
              fallbackPath="/"
              confirmMessage="You have unsaved changes. Are you sure you want to leave?"
              className="mb-6"
            />
            <h1 className="text-3xl font-bold mb-4">Create Campaign</h1>

            {hasDraft && showResumeBanner && !showPreview && (
              <ResumeDraftBanner
                onResume={handleResumeDraft}
                onDismiss={handleDismissDraft}
              />
            )}

            <WizardProgressHeader step={step} />

            {showPreview ? (
              <>
                {txStatus === "error" && txError && (
                  <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-3 mb-4">
                    <XCircle size={16} className="mt-0.5 shrink-0" />
                    {txError}
                  </div>
                )}
                <CampaignPreview
                  data={{ ...data, creatorAddress: address ?? "" }}
                  onEdit={back}
                  onDeploy={deploy}
                  deployDisabled={txStatus === "pending" || networkMismatch}
                  deployPending={txStatus === "pending"}
                />
              </>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{STEPS[step]}</h2>
                  <DraftIndicator
                    saveStatus={saveStatus}
                    lastSaved={lastSaved}
                    onSave={handleManualSave}
                    onResolveConflict={(resolution) => {
                      const remoteDraft = resolveConflict(resolution);
                      if (remoteDraft) {
                        const { step: savedStep, ...formFields } = remoteDraft;
                        restore(formFields, savedStep);
                      }
                    }}
                  />
                </div>

                {step === STEP.BASIC_INFO && (
                  <BasicInfoStep data={data} set={set} />
                )}
                {step === STEP.MEDIA && <MediaStep data={data} set={set} />}
                {step === STEP.FAQ_TEAM && (
                  <FaqTeamStep
                    data={data}
                    setFaqs={setFaqs}
                    setTeamMembers={setTeamMembers}
                  />
                )}
                {step === STEP.PLATFORM_CONFIG && (
                  <PlatformConfigStep data={data} set={set} />
                )}
                {step === STEP.REVIEW && <ReviewStep data={data} />}

                {validationError && (
                  <p className="text-red-500 dark:text-red-400 text-sm">
                    {validationError}
                  </p>
                )}

                {txStatus === "error" && txError && (
                  <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-3">
                    <XCircle size={16} className="mt-0.5 shrink-0" />
                    {txError}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    onClick={back}
                    disabled={step === 0}
                    className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition"
                  >
                    Back
                  </button>

                  <div className="flex items-center gap-2">
                    {step === LAST_FORM_STEP && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalOpen(true)}
                        className="flex items-center gap-2 border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-4 py-2 rounded-xl text-sm font-medium transition"
                      >
                        <Eye size={15} />
                        Preview
                      </button>
                    )}

                    {step < LAST_FORM_STEP ? (
                      <button
                        onClick={next}
                        className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition text-white"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        onClick={next}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition text-white"
                      >
                        Review & Deploy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </WalletGuard>

      <CampaignPreviewModal
        data={{ ...data, creatorAddress: address ?? "" }}
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onEdit={() => setPreviewModalOpen(false)}
        onPublish={deploy}
        publishDisabled={txStatus === "pending" || networkMismatch}
        publishPending={txStatus === "pending"}
      />
    </main>
  );
}
