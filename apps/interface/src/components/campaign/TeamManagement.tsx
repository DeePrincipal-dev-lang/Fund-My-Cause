"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";
import { useTeamManagement, type Role } from "@/hooks/useTeamManagement";
import { ROLE_COLORS } from "./team/RoleBadge";
import { ConfirmDialog } from "./team/ConfirmDialog";
import { TeamMemberList } from "./team/TeamMemberList";
import { TeamInvitationsList } from "./team/TeamInvitationsList";
import { TeamDelegationsList } from "./team/TeamDelegationsList";

interface TeamManagementProps {
  campaignId: string;
  currentUserAddress: string;
  onTeamUpdate?: () => void;
}

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Owner: [
    "Create Campaign",
    "Edit Metadata",
    "Manage Team",
    "Withdraw Funds",
    "Approve Contributions",
    "Update Status",
    "Configure Settings",
    "Manage Delegations",
    "Multi-Sig",
    "View Analytics",
  ],
  Admin: [
    "Edit Metadata",
    "Manage Team",
    "Approve Contributions",
    "Update Status",
    "Configure Settings",
    "Multi-Sig",
    "View Analytics",
  ],
  Editor: ["Edit Metadata", "View Analytics"],
  Viewer: ["View Analytics"],
  Contributor: ["View Analytics", "Approve Contributions"],
};

export function TeamManagement({
  campaignId,
  currentUserAddress,
  onTeamUpdate,
}: TeamManagementProps) {
  const {
    teamMembers,
    pendingInvitations,
    delegations,
    loading,
    error,
    successMessage,
    activeTab,
    setActiveTab,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    delegateAddress,
    setDelegateAddress,
    delegateRole,
    setDelegateRole,
    delegateDuration,
    setDelegateDuration,
    memberToRemove,
    setMemberToRemove,
    memberToRevokeDelegation,
    setMemberToRevokeDelegation,
    copiedCode,
    handleInviteMember,
    handleRemoveMember,
    handleCreateDelegation,
    handleRevokeDelegation,
    copyInvitationCode,
    isOwner,
    isAdmin,
  } = useTeamManagement({ campaignId, currentUserAddress, onTeamUpdate });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team data...
      </div>
    );
  }

  const cardCls =
    "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";

  const TABS: { key: typeof activeTab; label: string; count: number }[] = [
    { key: "members", label: "Team Members", count: teamMembers.length },
    {
      key: "invitations",
      label: "Invitations",
      count: pendingInvitations.length,
    },
    { key: "delegations", label: "Delegations", count: delegations.length },
  ];

  return (
    <div className="w-full space-y-4" data-testid="team-management">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        >
          {successMessage}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Team management"
        className="grid w-full grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow dark:bg-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <TeamMemberList
          isAdmin={isAdmin}
          isOwner={isOwner}
          currentUserAddress={currentUserAddress}
          teamMembers={teamMembers}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          onInviteEmailChange={setInviteEmail}
          onInviteRoleChange={setInviteRole}
          onInviteMember={handleInviteMember}
          onSelectMemberToRemove={setMemberToRemove}
        />
      )}

      {activeTab === "invitations" && (
        <TeamInvitationsList
          pendingInvitations={pendingInvitations}
          copiedCode={copiedCode}
          onCopyCode={copyInvitationCode}
        />
      )}

      {activeTab === "delegations" && (
        <TeamDelegationsList
          isAdmin={isAdmin}
          delegations={delegations}
          delegateAddress={delegateAddress}
          delegateRole={delegateRole}
          delegateDuration={delegateDuration}
          onDelegateAddressChange={setDelegateAddress}
          onDelegateRoleChange={setDelegateRole}
          onDelegateDurationChange={setDelegateDuration}
          onCreateDelegation={handleCreateDelegation}
          onSelectRevokeDelegation={setMemberToRevokeDelegation}
        />
      )}

      <div className={cardCls} data-testid="role-permissions-reference">
        <h3 className="mb-3 text-base font-semibold">
          Role Permissions Reference
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(ROLE_PERMISSIONS) as [Role, string[]][]).map(
            ([role, permissions]) => (
              <div key={role} className="space-y-2">
                <h4
                  className={`rounded p-2 font-semibold ${ROLE_COLORS[role]}`}
                >
                  {role}
                </h4>
                <ul className="ml-2 space-y-1 text-sm">
                  {permissions.map((perm) => (
                    <li key={perm} className="flex items-start">
                      <Check className="mr-2 mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>

      {memberToRemove && (
        <ConfirmDialog
          titleId="remove-member-title"
          title="Remove Team Member"
          description="Are you sure you want to remove this team member? They will no longer have access to this campaign."
          confirmLabel="Remove"
          onCancel={() => setMemberToRemove(null)}
          onConfirm={() => handleRemoveMember(memberToRemove)}
        />
      )}

      {memberToRevokeDelegation && (
        <ConfirmDialog
          titleId="revoke-delegation-title"
          title="Revoke Delegation"
          description="Are you sure you want to revoke this delegation? The delegatee will lose their delegated permissions."
          confirmLabel="Revoke"
          onCancel={() => setMemberToRevokeDelegation(null)}
          onConfirm={() => handleRevokeDelegation(memberToRevokeDelegation)}
        />
      )}
    </div>
  );
}
