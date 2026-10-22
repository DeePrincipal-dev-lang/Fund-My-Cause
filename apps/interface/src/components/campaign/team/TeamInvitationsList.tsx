"use client";

import React from "react";
import { Check, Clock, Copy } from "lucide-react";
import type { PendingInvitation } from "@/hooks/useTeamManagement";
import { RoleBadge } from "./RoleBadge";

interface TeamInvitationsListProps {
  pendingInvitations: PendingInvitation[];
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
}

const cardCls =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";

export function TeamInvitationsList({
  pendingInvitations,
  copiedCode,
  onCopyCode,
}: TeamInvitationsListProps) {
  const getDaysRemaining = (expiresAt: number) => {
    if (expiresAt === 0) return null;
    const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  return (
    <div role="tabpanel">
      <div className={cardCls}>
        <h3 className="mb-3 text-base font-semibold">Pending Invitations</h3>
        {pendingInvitations.length === 0 ? (
          <p className="text-gray-500">No pending invitations</p>
        ) : (
          <div className="space-y-3">
            {pendingInvitations.map((invitation) => {
              const daysRemaining = getDaysRemaining(invitation.expiresAt);
              return (
                <div
                  key={invitation.code}
                  data-testid={`invitation-${invitation.code}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invitation.invitee}</p>
                      <RoleBadge role={invitation.role} />
                      {invitation.accepted && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs dark:border-green-800 dark:bg-green-950/40">
                          <Check className="h-3 w-3" />
                          Accepted
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {daysRemaining && daysRemaining > 0
                        ? `Expires in ${daysRemaining} days`
                        : "Expired"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="max-w-xs truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                      {invitation.code}
                    </code>
                    <button
                      aria-label={`Copy invitation code for ${invitation.invitee}`}
                      onClick={() => onCopyCode(invitation.code)}
                      className="rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {copiedCode === invitation.code ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
