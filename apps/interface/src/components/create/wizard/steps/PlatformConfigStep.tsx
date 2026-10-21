"use client";

import { validateFeeBps } from "@/lib/validation";
import { Input } from "@fund-my-cause/components";
import { fieldStyles } from "../Fields";
import { useWizardStep } from "../useWizardStep";
import type { StepProps } from "../types";

/**
 * Wizard step 4 — optional platform fee recipient and rate.
 *
 * Both fields are optional individually, but a fee address without a rate is
 * rejected on Next (see `validatePlatformConfigStep`).
 */
export function PlatformConfigStep({ data, set }: StepProps) {
  const { errorFor } = useWizardStep(data, { feeBps: validateFeeBps });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Optional. Leave blank to skip the platform fee.
      </p>
      <Input
        {...fieldStyles}
        label="Platform Fee Address"
        placeholder="G... or C..."
        value={data.feeAddress}
        onChange={(e) => set("feeAddress", e.target.value)}
      />
      <Input
        {...fieldStyles}
        label="Fee (basis points, e.g. 250 = 2.5%)"
        error={errorFor("feeBps")}
        type="number"
        min="0"
        max="10000"
        placeholder="0"
        value={data.feeBps}
        onChange={(e) => set("feeBps", e.target.value)}
      />
    </div>
  );
}
