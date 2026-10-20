/**
 * Heavy components that are only used on secondary routes. Each is loaded as its own chunk
 * when the page that renders it mounts, so the first paint of other pages stays lighter.
 * Charts draw on the client only, so they are not rendered on the server.
 */
import dynamic from "next/dynamic";

export const LazyAnalyticsDashboard = dynamic(
  () => import("@/components/ui/AnalyticsDashboard").then((m) => m.AnalyticsDashboard),
  { ssr: false, loading: () => null },
);

export const LazyCampaignAnalytics = dynamic(
  () => import("@/components/ui/CampaignAnalytics").then((m) => m.CampaignAnalytics),
  { ssr: false, loading: () => null },
);
