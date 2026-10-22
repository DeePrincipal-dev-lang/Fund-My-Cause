# Implementation Plan: Campaign Updates

## Overview

Implement campaign updates incrementally: data layer first (`UpdateStore`), then the creation modal, then the dashboard integration, then the public feed on the campaign detail page, and finally edit/delete controls. Property-based tests use `fast-check`.

## Tasks

- [x] 1. Extend NotificationContext with campaign_update type
  - Add `"campaign_update"` to the `NotificationType` union in `src/context/NotificationContext.tsx`
  - Add a `Megaphone` (or `Newspaper`) icon case for `"campaign_update"` in `NotificationDropdown.tsx`'s `typeIcon()` function
  - Add `onClick` navigation to `/campaigns/<campaignId>` for notifications that carry a `campaignId`
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 2. Implement UpdateStore utility
  - Create `src/lib/updateStore.ts` exporting the `Update` interface and `getCids`, `createUpdate`, `fetchUpdate`, `editUpdate`, `deleteUpdate` functions
  - `createUpdate`: serialise `Update` to JSON, upload via `uploadToPinata`, prepend CID to `localStorage`, call optional `addNotification` callback
  - `fetchUpdate`: convert `ipfs://` CID to Pinata gateway URL, fetch and parse JSON
  - `editUpdate`: fetch existing update, merge patch, set `editedAt`, upload new JSON, replace old CID in `localStorage`
  - `deleteUpdate`: remove CID from `localStorage` array; handle missing/corrupted entries gracefully
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 6.3, 6.4, 7.3_

  - [ ]* 2.1 Write property tests for UpdateStore
    - **Property 1: Update round-trip serialisation** — for any valid `Update`, serialise to JSON and deserialise back; result should be equivalent
    - **Property 2: CID prepend ordering** — for any sequence of `createUpdate` calls, `getCids` returns CIDs most-recent first
    - **Property 3: Delete removes exactly one CID** — for any list of N CIDs, `deleteUpdate` yields N-1 with all others unchanged
    - **Property 4: localStorage corruption returns empty array** — corrupted or missing entry returns `[]` without throwing
    - **Property 8: Edit preserves createdAt and sets editedAt** — `editedAt > createdAt`, `createdAt` unchanged
    - **Property 9: Edit replaces old CID with new CID** — old CID absent, new CID present after `editUpdate`
    - **Property 10: Notification fired on successful create** — `addNotification` called exactly once with `type: "campaign_update"` and correct `campaignId`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 6.3, 6.4, 7.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create PostUpdateModal component
  - Create `src/components/ui/PostUpdateModal.tsx` with props `{ campaignId, campaignTitle, authorAddress, existingCid?, existingUpdate?, onClose, onSuccess }`
  - Implement `idle | submitting | error` state machine
  - Validate `title` (non-empty after trim, max 100 chars) and `body` (non-empty after trim, max 2000 chars) before calling `UpdateStore.createUpdate` or `UpdateStore.editUpdate`
  - Disable all controls while `submitting`; display error and stay open on failure; close and call `onSuccess(cid)` on success
  - Handle Escape key to close without uploading
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.2_

  - [ ]* 4.1 Write property and unit tests for PostUpdateModal
    - **Property 5: Whitespace-only title/body are invalid** — any all-whitespace `title` or `body` should be rejected without calling `createUpdate`
    - **Property 6: Controls disabled during upload** — in `submitting` state all inputs and submit button are disabled
    - Unit test: modal opens pre-populated when `existingUpdate` is provided
    - Unit test: cancel button and Escape key close modal without calling `createUpdate`
    - **Validates: Requirements 3.2, 3.4, 3.7, 6.2**

- [x] 5. Add Post Update button to Dashboard
  - In `src/app/dashboard/page.tsx`, add a "Post Update" button to `DashboardCampaignCard` when `campaign.status === "Active"`
  - Track `postUpdateTarget: string | null` state in `DashboardPage`; set it on button click, clear it on modal close
  - Render `<PostUpdateModal>` when `postUpdateTarget` is set, passing the campaign ID, title, and connected address
  - Disable the "Post Update" button while the modal is open for that card
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.1 Write unit tests for Dashboard Post Update integration
    - Unit test: "Post Update" button appears only for Active campaigns
    - Unit test: button is disabled while modal is open; re-enabled after close
    - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 6. Create UpdateFeed and UpdateCard components
  - Create `src/components/ui/UpdateFeed.tsx` exporting `UpdateFeed` with props `{ campaignId, connectedAddress? }`
  - On mount, read CIDs via `UpdateStore.getCids`, fetch all updates in parallel with `Promise.allSettled`
  - Sort resolved updates by `createdAt` descending before rendering
  - Render a loading skeleton while fetching, "No updates yet." when empty, error placeholder for failed fetches
  - Each `UpdateCard` displays `title`, `body`, relative timestamp (e.g. "3 days ago"), and an "Edited" label when `editedAt` is present
  - Show "Edit" and "Delete" buttons on `UpdateCard` when `connectedAddress === update.authorAddress`
  - Wire "Edit" to open `PostUpdateModal` with `existingCid` and `existingUpdate`; wire "Delete" to show a confirmation prompt then call `UpdateStore.deleteUpdate`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.1 Write property and unit tests for UpdateFeed
    - **Property 7: UpdateFeed renders updates in reverse-chronological order** — for any list of Updates with distinct `createdAt`, most-recent appears first in DOM
    - Unit test: loading skeleton shown while fetching
    - Unit test: "No updates yet." shown for empty CID list
    - Unit test: error placeholder shown for a failed fetch alongside successful cards
    - Unit test: "Edited" label present when `editedAt` is set
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 6.5**

- [x] 7. Integrate UpdateFeed into CampaignDetailPage
  - In `src/app/campaigns/[id]/page.tsx` (or its `CampaignDetailContent` client component), import and render `<UpdateFeed campaignId={id} connectedAddress={address} />`
  - Place the feed below the campaign description and above the transaction history
  - Pass the connected wallet address from `useWallet()` so edit/delete controls appear for the creator
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 7.1_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` is already available in the project; each property test runs a minimum of 100 iterations
- Each property test file includes a comment: `// Feature: campaign-updates, Property <N>: <title>`
- IPFS gateway base URL should be read from a constant (e.g. `PINATA_GATEWAY_URL`) to keep it configurable
