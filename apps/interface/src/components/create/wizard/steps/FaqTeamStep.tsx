"use client";

import { Trash2, PlusCircle } from "lucide-react";
import type { FAQ, TeamMember } from "@/types/campaign";
import { Input, Textarea } from "@fund-my-cause/components";
import { fieldStyles } from "../Fields";
import { FORM_FIELD_CLS } from "@/lib/formStyles";
import type { CampaignFormData } from "../types";

export interface FaqTeamStepProps {
  data: CampaignFormData;
  setFaqs: (faqs: FAQ[]) => void;
  setTeamMembers: (members: TeamMember[]) => void;
}

/**
 * Wizard step 3 — optional FAQs and team members.
 *
 * Both lists are edited in place: rows are keyed by a generated `id` so React
 * keeps input focus while the user types. Everything here is optional, so this
 * step never blocks navigation.
 */
export function FaqTeamStep({
  data,
  setFaqs,
  setTeamMembers,
}: FaqTeamStepProps) {
  const addFaq = () =>
    setFaqs([
      ...data.faqs,
      { id: crypto.randomUUID(), question: "", answer: "" },
    ]);

  const updateFaq = (id: string, field: "question" | "answer", val: string) =>
    setFaqs(data.faqs.map((f) => (f.id === id ? { ...f, [field]: val } : f)));

  const removeFaq = (id: string) =>
    setFaqs(data.faqs.filter((f) => f.id !== id));

  const addMember = () =>
    setTeamMembers([
      ...data.teamMembers,
      { id: crypto.randomUUID(), name: "", role: "" },
    ]);

  const updateMember = (id: string, field: keyof TeamMember, val: string) =>
    setTeamMembers(
      data.teamMembers.map((m) => (m.id === id ? { ...m, [field]: val } : m)),
    );

  const removeMember = (id: string) =>
    setTeamMembers(data.teamMembers.filter((m) => m.id !== id));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">FAQs</p>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 transition"
          >
            <PlusCircle size={13} /> Add FAQ
          </button>
        </div>
        {data.faqs.map((faq) => (
          <div
            key={faq.id}
            className="space-y-2 rounded-xl border border-gray-700 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                {...fieldStyles}
                fieldClassName={`${FORM_FIELD_CLS} flex-1`}
                aria-label="FAQ question"
                placeholder="Question"
                value={faq.question}
                onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeFaq(faq.id)}
                aria-label="Remove FAQ"
                className="text-gray-500 hover:text-red-400 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <Textarea
              {...fieldStyles}
              rows={2}
              aria-label="FAQ answer"
              placeholder="Answer"
              value={faq.answer}
              onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
            />
          </div>
        ))}
        {data.faqs.length === 0 && (
          <p className="text-xs text-gray-500">No FAQs added yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Team Members</p>
          <button
            type="button"
            onClick={addMember}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 transition"
          >
            <PlusCircle size={13} /> Add Member
          </button>
        </div>
        {data.teamMembers.map((m) => (
          <div
            key={m.id}
            className="space-y-2 rounded-xl border border-gray-700 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                {...fieldStyles}
                fieldClassName={`${FORM_FIELD_CLS} flex-1`}
                aria-label="Team member name"
                placeholder="Name"
                value={m.name}
                onChange={(e) => updateMember(m.id, "name", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeMember(m.id)}
                aria-label="Remove member"
                className="text-gray-500 hover:text-red-400 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <Input
              {...fieldStyles}
              aria-label="Team member role"
              placeholder="Role (e.g. Lead Developer)"
              value={m.role}
              onChange={(e) => updateMember(m.id, "role", e.target.value)}
            />
            <Input
              {...fieldStyles}
              aria-label="Team member bio"
              placeholder="Bio (optional)"
              value={m.bio ?? ""}
              onChange={(e) => updateMember(m.id, "bio", e.target.value)}
            />
            <Input
              {...fieldStyles}
              aria-label="Team member avatar URL"
              placeholder="Avatar URL (optional)"
              value={m.avatarUrl ?? ""}
              onChange={(e) => updateMember(m.id, "avatarUrl", e.target.value)}
            />
          </div>
        ))}
        {data.teamMembers.length === 0 && (
          <p className="text-xs text-gray-500">No team members added yet.</p>
        )}
      </div>
    </div>
  );
}
