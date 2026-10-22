import dynamic from 'next/dynamic';

// Route-based lazy loading
export const LazyDashboard = dynamic(() => import('@/app/[locale]/dashboard/page'), {
  loading: () => <div>Loading dashboard...</div>,
  ssr: true,
});

export const LazyCampaignCreate = dynamic(() => import('@/app/[locale]/create/page'), {
  loading: () => <div>Loading create campaign...</div>,
  ssr: true,
});

export const LazyCampaignDetail = dynamic(() => import('@/app/[locale]/campaigns/[id]/page'), {
  loading: () => <div>Loading campaign...</div>,
  ssr: true,
});

export const LazyBookmarks = dynamic(() => import('@/app/[locale]/bookmarks/page'), {
  loading: () => <div>Loading bookmarks...</div>,
  ssr: true,
});

// Component-level lazy loading
export const LazyPledgeModal = dynamic(
  () => import('@/components/ui/PledgeModal').then((mod) => mod.PledgeModal),
  {
    loading: () => <div>Loading pledge form...</div>,
    ssr: false,
  },
);

export const LazyFeatureFlagManager = dynamic(
  () =>
    import('@/components/FeatureFlagManager').then(
      (mod) => mod.FeatureFlagManagerUI,
    ),
  {
    loading: () => <div>Loading settings...</div>,
    ssr: false,
  },
);
