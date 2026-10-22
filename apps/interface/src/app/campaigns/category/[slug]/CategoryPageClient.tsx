"use client";

import Link from "next/link";
import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { LazyPledgeModal as PledgeModal } from "@/lib/lazy-components";
import {
  EmptyState,
  NoCampaignsIllustration,
} from "@/components/ui/EmptyState";
import { getCategoryBySlug, loadCampaignMeta } from "@/lib/categories";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { ArrowLeft } from "lucide-react";

export default function CategoryPageClient({ slug }: { slug: string }) {
  const category = getCategoryBySlug(slug)!;

  const campaigns = ALL_CAMPAIGNS.filter((c) => {
    const meta = loadCampaignMeta(c.contractId);
    return (meta.category ?? c.category) === slug;
  });

  const [pledge, setPledge] = useState<string | null>(null);
  const pledgeCampaign = campaigns.find((c) => c.id === pledge);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-500 transition mb-8"
        >
          <ArrowLeft size={14} /> Back to Campaigns
        </Link>

        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="text-6xl mb-4">{category.emoji}</div>
          <h1 className="text-4xl font-bold mb-3">{category.label}</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            {category.description}
          </p>
        </div>

        {/* Campaign grid */}
        {campaigns.length === 0 ? (
          <EmptyState
            illustration={<NoCampaignsIllustration />}
            title="No campaigns yet"
            description={`Be the first to launch a ${category.label} campaign.`}
            action={{
              label: "Create a Campaign",
              onClick: () => {
                window.location.href = "/create";
              },
            }}
          />
        ) : (
          <VirtualizedGrid
            items={campaigns}
            getKey={(campaign) => campaign.id}
            rowHeight={480}
            gap={24}
            minColumnWidth={340}
            aria-label={`${category.label} campaigns`}
            renderItem={(campaign, i) => (
              <CampaignCard
                campaign={campaign}
                onPledge={(id) => setPledge(id)}
                index={i}
              />
            )}
          />
        )}
      </div>

      {pledge && pledgeCampaign && (
        <PledgeModal
          contractId={pledge}
          campaignTitle={pledgeCampaign.title}
          onClose={() => setPledge(null)}
        />
      )}
    </main>
  );
}
