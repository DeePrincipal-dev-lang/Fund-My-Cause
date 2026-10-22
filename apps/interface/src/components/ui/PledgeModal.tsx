"use client";

import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { useToast } from "@/components/ui/Toast";
import { ReceiptModal } from "@/components/ui/ReceiptModal";
import { contribute } from "@/lib/contract";
import { useAccountExists } from "@/hooks/useAccountExists";
import { useTranslations } from "next-intl";
import { computePledgeSuggestions } from "@/lib/pledgeSuggestions";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Input } from "@fund-my-cause/components";
import { FORM_FIELD_CLS } from "@/lib/formStyles";
import { xlmAmountSchema, firstSchemaError } from "@/lib/validationSchemas";

const XLM_TO_STROOPS = 10_000_000n;
const PLEDGE_DEBOUNCE_MS = 2000;

interface PledgeModalProps {
  contractId: string;
  campaignTitle: string;
  /** Minimum contribution in stroops. */
  minContribution?: bigint;
  /** Per-contributor maximum in stroops (0 = no cap). */
  maxContribution?: bigint;
  /** Campaign goal in stroops (used for suggestion engine). */
  goalStroops?: bigint;
  /** Amount already raised in stroops (used for suggestion engine). */
  raisedStroops?: bigint;
  onClose: () => void;
  /** Called after a successful pledge so the parent can refresh stats. */
  onSuccess?: () => void;
  /** Called immediately on submit with XLM amount for optimistic UI update. */
  onOptimisticContribute?: (amountXlm: number) => void;
  /** Called on tx failure to roll back optimistic update. */
  onRollbackOptimistic?: () => void;
}

export function PledgeModal({
  contractId,
  campaignTitle,
  minContribution = 1n,
  maxContribution = 0n,
  goalStroops = 0n,
  raisedStroops = 0n,
  onClose,
  onSuccess,
  onOptimisticContribute,
  onRollbackOptimistic,
}: PledgeModalProps) {
  const { address, connect, signTx, isSigning } = useWallet();
  const { exists: accountExists, loading: accountLoading } =
    useAccountExists(address);
  const { addToast } = useToast();
  const t = useTranslations("pledgeModal");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pendingTx, setPendingTx] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const titleId = "pledge-modal-title";

  // Clear debounce timer on unmount to prevent memory leak (#746)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const isProcessingRef = useRef(false);
  const dialogRef = useFocusTrap(true, {
    onEscape: () => {
      if (!isProcessingRef.current) onClose();
    },
  }) as React.RefObject<HTMLDivElement>;

  const minXlm = Number(minContribution) / 1e7;

  // ── Suggestion engine ──────────────────────────────────────────────────────
  const suggestions = computePledgeSuggestions({
    goalStroops,
    raisedStroops,
    minContributionStroops: minContribution,
    maxContributionStroops: maxContribution,
  });

  const handlePledge = async () => {
    if (!address) {
      await connect();
      return;
    }
    if (pendingTx) return;

    const amountError = firstSchemaError(
      xlmAmountSchema(minXlm, {
        invalid: t("validationAmount"),
        belowMinimum: t("validationMinimum", { min: minXlm }),
      }),
      amount,
    );
    if (amountError) {
      addToast(amountError, "error");
      return;
    }

    const xlm = parseFloat(amount);
    const stroops = BigInt(Math.round(xlm * 1e7));

    setErrorMessage("");
    setPendingTx(true);
    setTxStatus("signing");
    onOptimisticContribute?.(xlm);

    try {
      const hash = await contribute(
        contractId,
        address,
        stroops,
        async (xdr) => {
          setTxStatus("signing");
          const signed = await signTx(xdr);
          setTxStatus("submitting");
          return signed;
        },
      );

      setTxStatus("confirming");
      setTxHash(hash);
      setTxStatus("success");
      setShowReceipt(true);
      addToast("Pledge submitted successfully!", "success", hash);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setErrorMessage(msg);
      setTxStatus("error");
      onRollbackOptimistic?.();
      addToast(msg, "error");
    } finally {
      setPendingTx(false);
    }
  };

  const handlePledgeWithDebounce = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(handlePledge, PLEDGE_DEBOUNCE_MS);
  };

  const handleDismiss = () => {
    setTxStatus("idle");
    setTxHash("");
    setErrorMessage("");
  };

  const isProcessing = txStatus !== "idle" || pendingTx || isSigning;
  isProcessingRef.current = isProcessing;

  const unfundedWarningId = "pledge-unfunded-warning";
  const minimumNoteId = "pledge-minimum-note";
  const showUnfundedWarning = Boolean(
    address && !accountLoading && !accountExists,
  );
  const showMinimumNote = minContribution > XLM_TO_STROOPS;
  const amountDescribedBy =
    [
      showUnfundedWarning ? unfundedWarningId : null,
      showMinimumNote ? minimumNoteId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    // Backdrop: closes modal on click. Keyboard dismissal (Escape) is handled by the focus trap inside the dialog.
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        className="ds-card p-6 w-full sm:max-w-md space-y-4 rounded-b-none sm:rounded-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex justify-between items-center">
          <h2 id={titleId} className="text-lg font-semibold">
            {t("title", { campaignTitle })}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            disabled={isProcessing}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {txStatus !== "idle" ? (
          <TransactionStatus
            status={txStatus}
            txHash={txHash}
            errorMessage={errorMessage}
            onDismiss={handleDismiss}
          />
        ) : (
          <>
            <div className="space-y-1">
              {showUnfundedWarning && (
                <p
                  id={unfundedWarningId}
                  className="text-xs text-yellow-400"
                  role="alert"
                >
                  {t("unfundedWarning")}
                </p>
              )}
              <Input
                unstyled
                id="pledge-amount"
                label={t("amountLabel", { min: minXlm })}
                labelClassName="sr-only"
                fieldClassName={FORM_FIELD_CLS}
                type="number"
                inputMode="decimal"
                placeholder={t("amountPlaceholder", { min: minXlm })}
                value={amount}
                min={minXlm}
                aria-describedby={amountDescribedBy}
                step="0.1"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAmount(e.target.value)
                }
                disabled={isProcessing}
                className="ds-input w-full px-4 py-3 disabled:opacity-50 text-base"
              />
              {showMinimumNote && (
                <p id={minimumNoteId} className="text-xs text-gray-500">
                  {t("minimumNote", { min: minXlm })}
                </p>
              )}
              {/* ── Suggestion chips ─────────────────────────────────────── */}
              {suggestions.length > 0 && (
                <div
                  className="flex flex-wrap gap-2 pt-1"
                  role="group"
                  aria-label="Suggested amounts"
                >
                  {suggestions.map((s) => {
                    const xlmValue = (Number(s.amountStroops) / 1e7).toString();
                    return (
                      <button
                        key={xlmValue}
                        type="button"
                        onClick={() => setAmount(xlmValue)}
                        disabled={isProcessing}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                          s.completesGoal
                            ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
                            : "bg-gray-800 border-gray-700 text-gray-300 hover:border-indigo-500 hover:text-white"
                        } disabled:opacity-40`}
                        aria-label={
                          s.completesGoal
                            ? `${s.label} — completes goal`
                            : s.label
                        }
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handlePledgeWithDebounce}
              disabled={isProcessing}
              aria-label={
                address
                  ? t("confirmPledgeAriaLabel", { campaignTitle })
                  : t("connectWalletAriaLabel")
              }
              className="ds-btn-primary w-full py-3 touch-manipulation"
            >
              {address ? t("confirmPledge") : t("connectWalletToPledge")}
            </button>
          </>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && txHash && address && (
        <ReceiptModal
          receipt={{
            campaignTitle,
            amount: parseFloat(amount),
            txHash,
            timestamp: new Date(),
            contractId,
            contributorAddress: address,
          }}
          onClose={() => {
            setShowReceipt(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
