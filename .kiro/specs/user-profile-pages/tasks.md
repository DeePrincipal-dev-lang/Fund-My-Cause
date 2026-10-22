# Implementation Plan: User Profile Pages

## Overview

Implement the `/profile/[address]` route with profile customization, campaign display, contribution history, and aggregate stats. Profile metadata is stored in localStorage via `profileStore`. Contribution data is fetched from the Soroban RPC layer. Avatar images are uploaded to IPFS via Pinata.

## Tasks

- [x] 1. Create data models and profileStore
  - [x] 1.1 Define `ProfileData` interface and `DEFAULT_PROFILE` constant in `src/types/profile.ts`
    - Fields: `avatarUri: string`, `bio: string`, `socialLinks: string[]`
    - _Requirements: 5.2, 7.1, 7.2_
  - [x] 1.2 Implement `profileStore` in `src/lib/profileStore.ts`
    - `readProfile(address: string): ProfileData` — reads from `localStorage` key `fmc:profile:${address}`, validates shape, returns `DEFAULT_PROFILE` on missing/invalid data, handles `localStorage` unavailability
    - `writeProfile(address: string, data: ProfileData): void` — serializes to JSON, writes to `localStorage`, silently no-ops if unavailable
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  - [ ]* 1.3 Write property tests for profileStore
    - **Property 1: Profile round-trip consistency** — for any valid `ProfileData`, write then read produces equivalent object
    - **Property 2: Invalid profile data returns default** — for any non-`ProfileData` string stored under a key, `readProfile` returns `DEFAULT_PROFILE`
    - **Validates: Requirements 7.4, 7.5**
    - Tag: `Feature: user-profile-pages, Property 1 & 2`

- [x] 2. Implement validation helpers
  - [x] 2.1 Create `src/lib/profileValidation.ts` with `validateBio(bio: string): boolean` (max 280 chars) and `validateSocialLinks(links: string[]): boolean` (max 5 items, each parseable by `new URL()`)
    - _Requirements: 5.5, 5.6, 6.1_
  - [ ]* 2.2 Write property tests for validation helpers
    - **Property 3: Bio length validation** — for any string with length > 280, `validateBio` returns false
    - **Property 4: Social links count validation** — for any array with length > 5, `validateSocialLinks` returns false
    - **Property 5: Social link URL validity** — for any valid `ProfileData`, every social link passes `new URL()` without throwing
    - **Validates: Requirements 5.5, 5.6, 6.1**
    - Tag: `Feature: user-profile-pages, Property 3, 4 & 5`

- [x] 3. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement `useContributions` hook and `useProfileStats` hook
  - [x] 4.1 Create `src/hooks/useContributions.ts`
    - Accepts `address: string`
    - Iterates all known campaign contract IDs via `fetchContribution` from `soroban.ts`
    - Returns `{ contributions: ContributionEntry[], loading: boolean, error: string | null, retry: () => void }`
    - `ContributionEntry`: `{ contractId, campaignTitle, amount, date }`
    - Sorts results by date descending
    - _Requirements: 3.1, 3.4_
  - [x] 4.2 Create `src/hooks/useProfileStats.ts`
    - Accepts campaigns array and contributions array
    - Computes `totalRaised`, `totalContributed`, `campaignCount`, `contributionCount`
    - Treats missing/undefined values as zero
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 4.3 Write property tests for `useProfileStats`
    - **Property 6: Stats totals are non-negative** — for any campaign/contribution arrays, `totalRaised` and `totalContributed` are ≥ 0
    - **Property 7: Stats counts match data length** — `campaignCount` equals campaigns array length, `contributionCount` equals contributions array length
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Tag: `Feature: user-profile-pages, Property 6 & 7`

- [x] 5. Build `ProfileHeader` component
  - [x] 5.1 Create `src/components/profile/ProfileHeader.tsx`
    - Props: `address`, `profile: ProfileData`, `isOwner: boolean`, `onEdit: () => void`
    - Renders avatar (img from `avatarUri`) or identicon fallback when `avatarUri` is empty
    - Displays truncated address (first 6 + last 4 chars) with copy-to-clipboard button
    - Renders bio text when non-empty
    - Renders "Edit Profile" button when `isOwner` is true
    - _Requirements: 1.3, 1.4, 5.1_

- [x] 6. Build `StatsBar` component
  - [x] 6.1 Create `src/components/profile/StatsBar.tsx`
    - Props: `campaignCount`, `totalRaised`, `contributionCount`, `totalContributed`, `loading`
    - Renders four stat tiles; shows loading skeleton when `loading` is true
    - Formats XLM values to two decimal places
    - _Requirements: 4.3, 4.4_

- [x] 7. Build `CampaignsSection` component
  - [x] 7.1 Create `src/components/profile/CampaignsSection.tsx`
    - Accepts `address: string`
    - Filters all campaigns from `fetchAllCampaigns()` where `campaign.creator === address`
    - Renders a campaign card per result showing title, status, raised, goal, deadline
    - Card click navigates to `/campaigns/[contractId]`
    - Shows loading skeleton while fetching, empty state when no campaigns found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8. Build `ContributionsSection` component
  - [x] 8.1 Create `src/components/profile/ContributionsSection.tsx`
    - Accepts `address: string`
    - Uses `useContributions` hook
    - Renders each contribution row: campaign title, amount in XLM, date
    - Shows loading skeleton, empty state, and retry button on error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Build `EditProfileModal` component
  - [x] 9.1 Create `src/components/profile/EditProfileModal.tsx`
    - Props: `address`, `current: ProfileData`, `onSave`, `onClose`
    - Avatar file input: on submit, calls `uploadToPinata`, stores resulting `ipfs://` URI; shows error toast on Pinata failure and retains previous avatar
    - Bio textarea with live character counter (max 280 chars)
    - Social links list: up to 5 URL inputs with add/remove buttons
    - Validates bio length and social links count/URL format before saving
    - On save, calls `writeProfile` then `onSave(updated)` to update parent state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 10. Build social links display in `ProfileHeader`
  - [x] 10.1 Extend `ProfileHeader` to render social links from `profile.socialLinks`
    - Each link is an `<a>` with `target="_blank" rel="noopener noreferrer"`
    - Detect Twitter/X (`twitter.com`, `x.com`), GitHub (`github.com`), LinkedIn (`linkedin.com`) and render corresponding SVG icon
    - Hide social links section entirely when `socialLinks` is empty
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 11. Assemble `/profile/[address]` page
  - [x] 11.1 Create `src/app/profile/[address]/page.tsx` as a client component
    - Validate `params.address` using existing `isValidContractId`-style check for Stellar G... addresses; show error message for invalid format
    - Use `useWallet` to determine `isOwner = address === params.address`
    - Compose `ProfileHeader`, `StatsBar`, `CampaignsSection`, `ContributionsSection`
    - Conditionally render `EditProfileModal` when edit button is clicked
    - Pass `onSave` callback that calls `writeProfile` and updates local state
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 12. Checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `profileStore` uses key `fmc:profile:${address}` consistent with existing `fmc:` namespace
- Bio max is 280 chars (requirements doc says 280; design doc says 300 — use 280 per requirements)
- Property tests use `fast-check` with minimum 100 iterations per test
- Avatar identicon fallback can use a simple deterministic color/initials approach based on address
