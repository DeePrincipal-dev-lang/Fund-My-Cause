"use client";

import { useState } from "react";
import { validateVideoUrl } from "@/lib/validation";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { VideoUploader } from "@/components/ui/VideoUploader";
import { logError } from "@/lib/errorLogger";
import { Input } from "@fund-my-cause/components";
import { Field, fieldStyles } from "../Fields";
import { useWizardStep } from "../useWizardStep";
import type { StepProps } from "../types";

/**
 * Wizard step 2 — campaign image and (optional) video.
 *
 * The video can either be uploaded or pasted in as a URL; the URL input is
 * hidden once an upload succeeds. Upload progress is local to this step, which
 * is why it owns its own `uploadError` state rather than taking it as a prop.
 */
export function MediaStep({ data, set }: StepProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { errorFor } = useWizardStep(data, { videoUrl: validateVideoUrl });

  return (
    <div className="space-y-4">
      <Field label="Campaign Image (PNG / JPG / WebP, max 5 MB)">
        <ImageUploader
          onUpload={(uri) => set("imageUrl", uri)}
          onClear={() => set("imageUrl", "")}
          currentUri={data.imageUrl}
        />
      </Field>

      <Field label="Campaign Video (optional — Upload MP4/WebM or provide YouTube/Vimeo URL)">
        <div className="space-y-3">
          <VideoUploader
            onUpload={(videoUrl) => {
              setUploadError(null);
              set("videoUrl", videoUrl);
            }}
            onError={(error) => {
              setUploadError(error);
              logError(error);
            }}
          />
          {uploadError && (
            <p role="alert" className="text-red-400 text-xs">
              {uploadError}
            </p>
          )}
          {!data.videoUrl && (
            <div className="border-t border-gray-700 pt-3">
              <p className="text-xs text-gray-500 mb-2">
                Or enter a video URL directly:
              </p>
              <Input
                {...fieldStyles}
                type="url"
                aria-label="Campaign video URL"
                placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
                value={data.videoUrl}
                onChange={(e) => set("videoUrl", e.target.value)}
              />
            </div>
          )}
          {errorFor("videoUrl") && (
            <p role="alert" className="text-red-400 text-xs mt-1">
              {errorFor("videoUrl")}
            </p>
          )}
          {data.videoUrl && !errorFor("videoUrl") && (
            <p className="text-green-400 text-xs mt-1">✓ Video URL is valid</p>
          )}
        </div>
      </Field>
    </div>
  );
}
