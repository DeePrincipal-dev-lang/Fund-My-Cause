import type { MetadataRoute } from "next";
import { fetchAllCampaigns } from "@/lib/graphql/client";
import { getAllSlugs, getCampaignSlug } from "@/lib/slugs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fund-my-cause.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/campaigns`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  // Always include slug routes from the static registry
  const slugRoutes: MetadataRoute.Sitemap = getAllSlugs().map(({ slug }) => ({
    url: `${BASE_URL}/campaigns/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  try {
    const campaigns = await fetchAllCampaigns();
    // Include both canonical slug URLs and legacy ID URLs (lower priority)
    const campaignRoutes: MetadataRoute.Sitemap = campaigns.flatMap((c) => {
      const slug = getCampaignSlug(c.contractId);
      const entries: MetadataRoute.Sitemap = [
        {
          url: `${BASE_URL}/campaigns/${slug}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.8,
        },
      ];
      // Keep legacy ID URL for backward compat (lower priority to avoid duplicate penalty)
      if (slug !== c.contractId) {
        entries.push({
          url: `${BASE_URL}/campaigns/${c.contractId}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.5,
        });
      }
      return entries;
    });
    return [...staticRoutes, ...campaignRoutes];
  } catch {
    // Fall back to slug-only routes when Soroban is unavailable
    return [...staticRoutes, ...slugRoutes];
  }
}
