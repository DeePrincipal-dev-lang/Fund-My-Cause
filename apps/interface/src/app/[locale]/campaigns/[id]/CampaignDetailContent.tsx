"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ShareButton } from "@/components/ui/ShareButton";
import { ContributorList } from "@/components/campaign-detail/ContributorList";
import { EmbedCodeGenerator } from "@/components/ui/EmbedCodeGenerator";

// Lazy-load UpdatesFeed — not needed on initial paint
const UpdatesFeed = dynamic(
  () =>
    import("@/components/campaign-detail/UpdatesFeed").then(
      (m) => m.UpdatesFeed,
    ),
  { ssr: false },
);
import { useCampaign } from "@/hooks/useCampaign";
import { useWallet } from "@/hooks/useWallet";
import { CampaignActions } from "./CampaignActions";
import { formatXLM, formatAddress } from "@/lib/format";
import { SimilarCampaigns } from "@/components/ui/SimilarCampaigns";
import { VideoPlayer } from "@/components/ui/VideoPlayer";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { TeamMemberCard } from "@/components/ui/TeamMemberCard";
import { TeamManagement } from "@/components/campaign/TeamManagement";
import { TrustSignals } from "@/components/ui/TrustSignals";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { Confetti } from "@/components/ui/Confetti";
import { GoalSuccessModal } from "@/components/ui/GoalSuccessModal";
import { GoalSuccessBadge } from "@/components/ui/GoalSuccessBadge";
import { ShareModal } from "@/components/ui/ShareModal";
import { PausedBanner } from "@/components/ui/PausedBanner";
import { LazyCampaignAnalytics } from "@/lib/lazy-components";
import { CampaignDetailSkeleton } from "@fund-my-cause/components";
import { useTranslations } from "next-intl";

function ContractIdRow({ contractId }: { contractId: string }) {
  const t = useTranslations("campaignDetail");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(contractId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 dark:bg-gray-900">
      <span className="font-mono text-xs text-gray-500 break-all flex-1">
        {contractId}
      </span>
      <div className="relative flex items-center gap-2">
        <button
          onClick={handleCopy}
          aria-label={t("copyContractId")}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
        >
          {copied ? (
            <Check size={13} className="text-green-500" />
          ) : (
            <Copy size={13} />
          )}
          <span className={cn(copied && "text-green-500")}>
            {copied ? t("copied") : t("copy")}
          </span>
        </button>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${contractId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("viewExplorer")}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-indigo-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
        >
          <ExternalLink size={13} /> {t("explorer")}
        </a>
      </div>
    </div>
  );
}

export function CampaignDetailContent({ contractId }: { contractId: string }) {
  const tDetail = useTranslations("campaignDetail");
  const {
    info,
    stats,
    loading,
    error,
    refresh,
    applyOptimisticContribution,
    rollbackOptimistic,
  } = useCampaign(contractId);
  const { address } = useWallet();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // Track whether we've already shown the modal for this campaign load
  const celebratedRef = useRef(false);

  // Read pause reason from localStorage (set by admin when pausing from dashboard)
  const pauseReason =
    typeof window !== "undefined"
      ? (localStorage.getItem(`fmc:pause_reason:${contractId}`) ?? undefined)
      : undefined;

  // Show celebration once for the creator when goal is met
  useEffect(() => {
    if (!info || !stats) return;
    const goalMet = stats.totalRaised >= stats.goal;
    const isCreator = !!address && address === info.creator;
    if (goalMet && isCreator && !celebratedRef.current) {
      celebratedRef.current = true;
      setShowConfetti(true);
      setShowSuccessModal(true);
    }
  }, [info, stats, address]);

  if (loading) {
    return <CampaignDetailSkeleton />;
  }

  if (error || !info || !stats) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm text-red-600 dark:text-red-300">
            {error ?? tDetail("dataUnavailable")}
          </p>
          <button
            onClick={refresh}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            {tDetail("retry")}
          </button>
        </div>
      </div>
    );
  }

  const progress =
    stats.goal > 0n
      ? Number((stats.totalRaised * 10_000n) / stats.goal) / 100
      : 0;
  const deadlineIso = new Date(Number(info.deadline) * 1000).toISOString();
  const deadlinePassed = Number(info.deadline) * 1000 < Date.now();
  const goalMet = stats.totalRaised >= stats.goal;
  const totalRaisedXlm = Number(stats.totalRaised) / 1e7;

  return (
    <>
      {showConfetti && <Confetti />}

      {showSuccessModal && info && (
        <GoalSuccessModal
          campaignTitle={info.title}
          totalRaisedXlm={totalRaisedXlm}
          onClose={() => setShowSuccessModal(false)}
          onShare={() => {
            setShowSuccessModal(false);
            setShowShareModal(true);
          }}
          onWithdraw={() => setShowSuccessModal(false)}
          alreadyWithdrawn={info.status === "Successful"}
        />
      )}

      {showShareModal && info && (
        <ShareModal
          campaignId={contractId}
          campaignTitle={info.title}
          onClose={() => setShowShareModal(false)}
        />
      )}

      <div className="w-full h-72 overflow-hidden md:h-96 relative">
        <Image
          src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1600"
          alt={info.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div>
          <h1 className="mb-2 text-3xl font-bold">{info.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-500">
            by{" "}
            <span
              className="font-mono text-gray-500 dark:text-gray-400"
              title={info.creator}
            >
              {formatAddress(info.creator)}
            </span>
          </p>
        </div>

        <ContractIdRow contractId={contractId} />

        <div className="space-y-2">
          <ProgressBar progress={progress} />
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{formatXLM(stats.totalRaised)} raised</span>
            <span>{formatXLM(stats.goal)} goal</span>
          </div>
        </div>

        {goalMet && <GoalSuccessBadge totalRaisedXlm={totalRaisedXlm} />}

        {info.status === "Paused" && <PausedBanner reason={pauseReason} />}

        <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <p className="text-xl font-semibold">{stats.contributorCount}</p>
            <p className="mt-1 text-xs text-gray-500">Contributors</p>
          </div>
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <p className="text-xl font-semibold">
              {formatXLM(stats.averageContribution)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Avg. contribution</p>
          </div>
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <CountdownTimer deadline={deadlineIso} />
            <p className="mt-1 text-xs text-gray-500">Remaining</p>
          </div>
        </div>

        <LazyCampaignAnalytics stats={stats} info={info} />

        <p className="leading-relaxed text-gray-700 dark:text-gray-300">
          {info.description}
        </p>

        {/* Video player — show if campaign has a videoUrl in mock data */}
        {(() => {
          const mockCampaign = ALL_CAMPAIGNS.find((c) => c.id === contractId);
          return mockCampaign?.videoUrl ? (
            <VideoPlayer url={mockCampaign.videoUrl} />
          ) : null;
        })()}

        <ContributorList
          contractId={contractId}
          totalRaised={stats.totalRaised}
          connectedAddress={address}
        />

        <UpdatesFeed
          campaignId={contractId}
          campaignTitle={info.title}
          connectedAddress={address ?? undefined}
        />

        <ShareButton campaignId={contractId} campaignTitle={info.title} />

        <EmbedCodeGenerator
          campaignId={contractId}
          campaignTitle={info.title}
        />

        {info.socialLinks.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Links</p>
            <ul className="space-y-1">
              {info.socialLinks.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CampaignActions
          contractId={contractId}
          creator={info.creator}
          deadlinePassed={deadlinePassed}
          goalMet={goalMet}
          campaignTitle={info.title}
          status={info.status}
          onOptimisticContribute={applyOptimisticContribution}
          onRollbackOptimistic={rollbackOptimistic}
        />

        {/* Team Management (RBAC) — visible once a wallet is connected */}
        {address && (
          <div className="space-y-3" data-testid="team-management-section">
            <h2 className="text-lg font-semibold">Manage Team</h2>
            <TeamManagement
              campaignId={contractId}
              currentUserAddress={address}
            />
          </div>
        )}

        {/* Trust Signals */}
        {(() => {
          const mock = ALL_CAMPAIGNS.find((c) => c.id === contractId);
          const trustData: Record<string, unknown> = {
            isVerified: true,
            campaignCount: 3,
            accountAgeDays: 420,
            backerCount: Number(stats.contributorCount),
            isAudited: false,
            ...(mock as Record<string, unknown> | undefined),
          };
          return (
            <TrustSignals
              data={{
                isVerified: Boolean(trustData.isVerified),
                campaignCount: Number(trustData.campaignCount),
                accountAgeDays: Number(trustData.accountAgeDays),
                backerCount: Number(trustData.backerCount),
                isAudited: Boolean(trustData.isAudited),
                auditUrl: trustData.auditUrl as string | undefined,
              }}
            />
          );
        })()}

        {/* Team Members */}
        {(() => {
          const mock = ALL_CAMPAIGNS.find((c) => c.id === contractId);
          const members = (mock as { teamMembers?: unknown[] } | undefined)
            ?.teamMembers;
          if (!members || members.length === 0) return null;
          return (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Team</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  members as Parameters<typeof TeamMemberCard>[0]["member"][]
                ).map((m) => (
                  <TeamMemberCard key={m.id} member={m} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* FAQ */}
        {(() => {
          const mock = ALL_CAMPAIGNS.find((c) => c.id === contractId);
          const faqs = (mock as { faqs?: unknown[] } | undefined)?.faqs;
          if (!faqs || faqs.length === 0) return null;
          return (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">FAQ</h2>
              <FAQAccordion
                faqs={faqs as Parameters<typeof FAQAccordion>[0]["faqs"]}
              />
            </div>
          );
        })()}

        <SimilarCampaigns campaignId={contractId} />
      </div>
    </>
  );
}
