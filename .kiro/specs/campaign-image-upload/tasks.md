# Implementation Plan: Campaign Image Upload

## Overview

Implement the campaign image upload feature incrementally: validation utility first, then the crop/upload component, then wire it into the create flow, and finally add fallback images to CampaignCard. Property-based tests use `fast-check`.

## Tasks

- [x] 1. Create ImageValidator utility
  - Create `src/lib/imageValidation.ts` exporting `validateImageFile`, `ACCEPTED_TYPES`, `MAX_FILE_SIZE`, and `ValidationResult` type
  - Implement type-check first, then size-check, returning the appropriate error strings from Requirements 1.1–1.4
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 Write property tests for ImageValidator
    - Add `fast-check` to devDependencies if absent
    - **Property 1: Invalid MIME type is always rejected**
    - **Property 2: Oversized file is always rejected**
    - **Property 3: Valid file is always accepted**
    - Include edge-case unit test: both type and size invalid → type error returned first
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. Create CropTool component
  - Add `react-image-crop` to dependencies
  - Create `src/components/ui/CropTool.tsx` with props `{ imageSrc, onConfirm, onCancel }`
  - Lock aspect ratio to `16 / 9`
  - On confirm: draw crop to offscreen canvas, call `canvas.toBlob(cb, "image/webp", 0.9)`, pass blob to `onConfirm`; handle null blob with error callback
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.1 Write property tests for CropTool
    - **Property 9: Cropped output is always a WebP blob**
    - Unit test: aspect ratio is configured as 16/9
    - **Validates: Requirements 3.4, 3.5**

- [x] 3. Create ImageUploader component
  - Create `src/components/ui/ImageUploader.tsx` with props `{ onUpload, onClear, currentUri? }`
  - Implement the state machine: `idle → dragging → cropping → uploading → done / error`
  - Wire drag-and-drop handlers (`onDragEnter`, `onDragLeave`, `onDragOver`, `onDrop`) and hidden file input
  - Call `validateImageFile` on both drop and picker paths; display errors inline
  - Render `CropTool` when state is `cropping`; on confirm call `uploadToPinata`; on cancel return to idle
  - Disable drop zone and file input while state is `uploading`
  - Display IPFS URI on success; display error message and return to idle on failure
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.1 Write property tests for ImageUploader
    - **Property 4: Drag highlight is toggled on enter and removed on leave**
    - **Property 5: Drop and file-picker produce equivalent behaviour**
    - **Property 6: Controls are disabled during upload**
    - **Property 7: Crop is shown before upload; upload not triggered until confirm**
    - **Property 8: Cancelling crop returns to idle without uploading**
    - **Property 10: Successful upload stores URI and displays it**
    - **Property 11: Failed upload shows error and returns to idle**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 4.2, 4.3, 4.4**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate ImageUploader into the create flow
  - In `src/app/create/page.tsx` Step2, replace the existing file-input implementation with `<ImageUploader onUpload={(uri) => set("imageUrl", uri)} onClear={() => set("imageUrl", "")} currentUri={data.imageUrl} />`
  - Remove the now-redundant inline `handleFile`, `preview`, `uploading`, and `uploadError` state from Step2
  - Verify `deploy()` already passes `imageUrl` as `socialLinks[0]` when non-empty, and `undefined` when empty (matches existing code; adjust if needed)
  - _Requirements: 2.1–2.5, 3.1–3.5, 4.1–4.5, 5.1, 5.2_

  - [ ]* 5.1 Write property test for socialLinks mapping
    - **Property 12: socialLinks mapping from imageUrl**
    - Mock `buildInitializeTx` and assert call arguments for both empty and non-empty `imageUrl`
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Add fallback image helpers and update CampaignCard
  - Add `getFallbackImage(id: string): string` and `isValidImageUri(uri?: string): boolean` to `src/lib/imageValidation.ts`
  - In `CampaignCard`, resolve image src using `isValidImageUri`; add `onError` handler that sets local state to `getFallbackImage(campaign.id)`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.1 Write property tests for CampaignCard fallback behaviour
    - **Property 13: Image vs fallback rendering based on URI validity**
    - **Property 14: Fallback is deterministic for a given campaign id**
    - **Property 15: onError triggers fallback**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` property tests run a minimum of 100 iterations each
- Each property test file includes a comment: `// Feature: campaign-image-upload, Property <N>: <title>`
- `react-image-crop` is the crop library; install with `npm install react-image-crop`
