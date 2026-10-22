# Bundle Optimization Guide

This document describes the per-route bundle budgets and provides tips for keeping the frontend bundle lean.

## Budgets

Budgets are defined in [`apps/interface/bundle-budgets.json`](../apps/interface/bundle-budgets.json). CI enforces these budgets on every build — exceeding them will fail the `frontend_ci` workflow.

| Route | JS Budget | CSS Budget | Total |
|-------|-----------|------------|-------|
| `/` (landing) | 250 KB | 80 KB | 330 KB |
| `/campaigns` | 300 KB | 90 KB | 390 KB |
| `/campaigns/[id]` | 400 KB | 100 KB | 500 KB |
| `/create` | 350 KB | 90 KB | 440 KB |
| `/dashboard` | 350 KB | 90 KB | 440 KB |
| `/bookmarks` | 200 KB | 70 KB | 270 KB |
| `/settings` | 200 KB | 70 KB | 270 KB |
| `/embed/**` | 100 KB | 30 KB | 130 KB |
| Shared/framework | 180 KB | 50 KB | 230 KB |

## Optimization tips

### Code splitting

- Use **dynamic imports** (`next/dynamic`) for components not needed on initial render (e.g., modals, heavy charts, rich text editors)
- Lazy-load third-party libraries that are only used in specific user flows

```tsx
import dynamic from "next/dynamic";
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), { ssr: false });
```

### Dependency hygiene

- **Audit regularly**: `npm ls --depth=0` to see top-level deps; remove anything unused
- **Prefer smaller alternatives**: e.g., `date-fns` over `moment`, `zod` over `joi`
- **Tree-shake imports**: import only what you need:

```tsx
// Good
import { formatDistance } from "date-fns";
// Bad
import { formatDistance } from "date-fns/formatDistance";
```

### CSS

- Tailwind's JIT compiler strips unused styles automatically — keep purge content paths accurate
- Avoid large CSS-in-JS runtime libraries; prefer Tailwind utility classes
- Keep custom CSS files small; extract repeated patterns into Tailwind components

### Image optimization

- Use `next/image` for automatic responsive images, lazy loading, and WebP/AVIF conversion
- Set explicit `width` and `height` to prevent layout shift and avoid loading oversized images
- Use CDN with image transformation for user-uploaded images

### Route-specific patterns

- **Campaign detail page** (`/campaigns/[id]`): the largest page by budget — keep campaign-specific components code-split
- **Embed widget**: must stay under 130 KB total — avoid any non-essential dependency
- **Shared chunks**: every new page adds framework overhead; consolidate routing where possible

## Local analysis

Run the budget check locally before pushing:

```bash
cd apps/interface
npm run build
node scripts/check-bundle-budgets.js
```

You can also use the built-in `bundleAnalysis.ts` utility for deeper analysis:

```ts
import { analyzeBundleSize, identifyLargeDependencies } from "@/lib/bundleAnalysis";
```

## Troubleshooting budget failures

| Symptom | Likely cause |
|---------|-------------|
| Shared chunk exceeds 180 KB | New large dependency added to `_app.tsx` or a shared layout |
| Route budget spikes without code changes | New import added to a page-level component |
| CSS budget exceeded | Large CSS library imported globally; verify Tailwind purge config |

## Updating budgets intentionally

If a new feature genuinely requires more bundle space, follow this workflow so the change is deliberate and visible:

1. **Build locally** and confirm the actual sizes:
   ```bash
   cd apps/interface
   npm run build
   node scripts/check-bundle-budgets.cjs
   ```
2. **Open `bundle-budgets.json`** and increase the affected route budget to the new actual size, **rounded up to the nearest 10 KB**.  Use the smallest value that still passes — budgets are ceilings, not targets.
3. **Document the reason** in your PR description. Include before/after sizes and why the increase is justified (e.g., "Added PDF export library to `/dashboard`; +42 KB JS").
4. **Update the table above** in this file so reviewers can see the current budgets at a glance.

> ⚠️ Never raise a budget just to make the build pass without understanding why it grew. If the cause is unclear, run `npm run bundle:check` after the build and inspect the output to identify the offending chunk.
