"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Role, TeamMember } from "@/hooks/useTeamManagement";
import { RoleBadge } from "./RoleBadge";

interface TeamMemberListProps {
  isAdmin: boolean;
  isOwner: boolean;
  currentUserAddress: string;
  teamMembers: TeamMember[];
  inviteEmail: string;
  inviteRole: Role;
  onInviteEmailChange: (val: string) => void;
  onInviteRoleChange: (val: Role) => void;
  onInviteMember: () => void;
  onSelectMemberToRemove: (address: string) => void;
}

const ADMIN_INVITE_ROLES: Role[] = ["Admin", "Editor", "Viewer", "Contributor"];
const cardCls =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";
const inputCls =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

export function TeamMemberList({
  isAdmin,
  isOwner,
  currentUserAddress,
  teamMembers,
  inviteEmail,
  inviteRole,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteMember,
  onSelectMemberToRemove,
}: TeamMemberListProps) {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString();

  return (
    <div className="space-y-4" role="tabpanel">
      {isAdmin && (
        <div className={cardCls}>
          <h3 className="mb-3 text-base font-semibold">Invite Team Member</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              className={inputCls}
              placeholder="Email address"
              aria-label="Email address"
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
            />
            <select
              className={inputCls}
              aria-label="Invite role"
              value={inviteRole}
              onChange={(e) => onInviteRoleChange(e.target.value as Role)}
            >
              {(!isOwner ? (["Viewer"] as Role[]) : ADMIN_INVITE_ROLES).map(
                (role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ),
              )}
            </select>
            <button
              onClick={onInviteMember}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 md:col-span-2"
            >
              <Plus className="h-4 w-4" />
              Send Invitation
            </button>
          </div>
        </div>
      )}

      <div className={cardCls}>
        <h3 className="mb-3 text-base font-semibold">Current Team</h3>
        <div className="space-y-3">
          {teamMembers.map((member) => (
            <div
              key={member.address}
              data-testid={`team-member-${member.address}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                    {member.address.slice(0, 6)}...
                    {member.address.slice(-4)}
                  </code>
                  <RoleBadge role={member.role} />
                  {!member.isActive && (
                    <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Added {formatDate(member.addedAt)}
                  {member.expiresAt > 0 && (
                    <> • Expires {formatDate(member.expiresAt)}</>
                  )}
                </p>
              </div>
              {isAdmin && member.address !== currentUserAddress && (
                <button
                  aria-label={`Remove ${member.address}`}
                  onClick={() => onSelectMemberToRemove(member.address)}
                  className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
