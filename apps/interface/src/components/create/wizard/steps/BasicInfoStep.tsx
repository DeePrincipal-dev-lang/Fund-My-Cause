"use client";

import {
  validateTitle,
  validateDescription,
  validateGoal,
  validateDeadline,
  validateMinContribution,
} from "@/lib/validation";
import { CATEGORY_TAXONOMY } from "@/lib/categories";
import { Input, Select, Textarea } from "@fund-my-cause/components";
import { fieldStyles } from "../Fields";
import { useWizardStep } from "../useWizardStep";
import type { StepProps } from "../types";

/**
 * Wizard step 1 — contract/token addresses plus the campaign's core details.
 *
 * Field-level errors are shown as-you-type, but only once a field is non-empty,
 * so an untouched form isn't covered in "required" errors. The blocking
 * required-field check happens in `validateBasicInfoStep` on Next.
 */
export function BasicInfoStep({ data, set }: StepProps) {
  const { errorFor } = useWizardStep(data, {
    title: validateTitle,
    description: validateDescription,
    goal: validateGoal,
    deadline: validateDeadline,
    minContribution: (value, all) => validateMinContribution(value, all.goal),
  });

  return (
    <div className="space-y-4">
      <Input
        {...fieldStyles}
        label="Contract ID"
        placeholder="C..."
        value={data.contractId}
        onChange={(e) => set("contractId", e.target.value)}
      />
      <Input
        {...fieldStyles}
        label="Token Address"
        placeholder="C..."
        value={data.token}
        onChange={(e) => set("token", e.target.value)}
      />
      <Input
        {...fieldStyles}
        label="Title"
        error={errorFor("title")}
        required
        placeholder="My Campaign"
        value={data.title}
        onChange={(e) => set("title", e.target.value)}
      />
      <Textarea
        {...fieldStyles}
        label="Description"
        error={errorFor("description")}
        required
        rows={3}
        placeholder="What are you raising funds for?"
        value={data.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <Select
        {...fieldStyles}
        label="Category"
        placeholder="Select a category…"
        value={data.category}
        onChange={(e) => set("category", e.target.value)}
        options={CATEGORY_TAXONOMY.map((cat) => ({
          value: cat.slug,
          label: `${cat.emoji} ${cat.label}`,
        }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          {...fieldStyles}
          label="Goal (XLM)"
          error={errorFor("goal")}
          required
          type="number"
          min="1"
          placeholder="10000"
          value={data.goal}
          onChange={(e) => set("goal", e.target.value)}
        />
        <Input
          {...fieldStyles}
          label="Min Contribution (XLM)"
          error={errorFor("minContribution")}
          required
          type="number"
          min="1"
          placeholder="1"
          value={data.minContribution}
          onChange={(e) => set("minContribution", e.target.value)}
        />
      </div>
      <Input
        {...fieldStyles}
        label="Deadline"
        error={errorFor("deadline")}
        required
        type="date"
        value={data.deadline}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => set("deadline", e.target.value)}
      />
    </div>
  );
}
