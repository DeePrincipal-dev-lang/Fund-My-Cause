# Implementation Plan: Campaign Categories

## Tasks

- [x] 1. Create category taxonomy
  - Create `src/lib/categories.ts` with `CATEGORY_TAXONOMY`, `getCategoryBySlug`, and `isValidCategorySlug`
  - Add `description` field to each category entry for landing pages
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.1 Write property tests for taxonomy helpers
    - **Property 1: Taxonomy slug uniqueness**
    - **Property 2: getCategoryBySlug round-trip**
    - **Property 3: getCategoryBySlug rejects unknown slugs**
    - **Property 4: isValidCategorySlug is consistent with getCategoryBySlug**
    - **Validates: Requirements 1.4, 1.5**

- [x] 2. Extend Campaign type and metadata storage
  - Add optional `category?: string` to `Campaign` in `src/types/campaign.ts`
  - Add helper `saveCampaignMeta(contractId, meta)` and `loadCampaignMeta(contractId)` in `src/lib/categories.ts` using localStorage key `fmc:campaign-meta:{contractId}`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Add category selector to CreateFlow Step 1
  - Add `category: string` to `FormData` and `INITIAL` in `create/page.tsx`
  - Render a `<select>` in `Step1` below the description field, populated from `CATEGORY_TAXONOMY`
  - Update `validateStep(0)` to return an error if `category` is empty
  - On successful deploy, call `saveCampaignMeta(contractId, { category })` before redirecting
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Add CategoryBadge to CampaignCard
  - Add inline `CategoryBadge` component to `CampaignCard.tsx`
  - Position `absolute top-3 right-3` on the image area
  - Render only when `getCategoryBySlug(campaign.category)` returns a value
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.1 Write property tests for CategoryBadge rendering
    - **Property 6: Unknown category slug degrades gracefully**
    - **Validates: Requirements 3.2, 6.4**

- [x] 5. Add category filter to campaigns page
  - Add category pill row above the existing status filter tabs in `CampaignsInner`
  - Read/write `category` URL param via `setParam`
  - Apply category filter in the `filtered` computation alongside existing filters
  - Default to "all" when param is absent or unrecognised
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 5.1 Write property tests for category filter logic
    - **Property 5: Category filter composes correctly**
    - **Validates: Requirements 4.2, 4.8**

- [x] 6. Create category landing pages
  - Create `src/app/campaigns/category/[slug]/page.tsx`
  - Generate static params from `CATEGORY_TAXONOMY`
  - Return `notFound()` for unknown slugs
  - Render category hero (emoji + label + description), campaign grid filtered by slug, empty state, and back link
  - Merge `loadCampaignMeta` data into campaigns for category matching
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7. Final checkpoint — ensure all tests pass
  - Run full test suite; fix any failures before marking complete.

## Notes

- Tasks marked `*` are optional property-based tests; skip for a faster MVP
- fast-check is the PBT library; add to devDependencies if absent
- localStorage is used for off-chain metadata (consistent with existing dashboard registry pattern)
