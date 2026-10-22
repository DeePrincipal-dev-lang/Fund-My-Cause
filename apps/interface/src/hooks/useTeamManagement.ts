"use client";

import { useState, useEffect, useCallback } from "react";

export type Role = "Owner" | "Admin" | "Editor" | "Viewer" | "Contributor";

export interface TeamMember {
  address: string;
  role: Role;
  addedAt: number;
  expiresAt: number;
  isActive: boolean;
}

export interface PendingInvitation {
  code: string;
  invitee: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
  accepted: boolean;
}

export interface RoleDelegate {
  delegator: string;
  delegatee: string;
  role: Role;
  expiresAt: number;
  isActive: boolean;
}

interface UseTeamManagementOptions {
  campaignId: string;
  currentUserAddress: string;
  onTeamUpdate?: () => void;
}

export function useTeamManagement({
  campaignId,
  currentUserAddress,
  onTeamUpdate,
}: UseTeamManagementOptions) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [delegations, setDelegations] = useState<RoleDelegate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "members" | "invitations" | "delegations"
  >("members");

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Viewer");
  const [delegateAddress, setDelegateAddress] = useState("");
  const [delegateRole, setDelegateRole] = useState<Role>("Editor");
  const [delegateDuration, setDelegateDuration] = useState<string>("7");

  // Modals / Selection states
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [memberToRevokeDelegation, setMemberToRevokeDelegation] = useState<
    string | null
  >(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      // NOTE: Mock data until backend Team Management API is implemented.
      // See docs/TEAM_MANAGEMENT_BACKEND_PREREQUISITE.md for API requirements.
      const mockMembers: TeamMember[] = [
        {
          address: currentUserAddress,
          role: "Owner",
          addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          expiresAt: 0,
          isActive: true,
        },
      ];
      setTeamMembers(mockMembers);
      setPendingInvitations([]);
      setDelegations([]);
      setError(null);
    } catch (err) {
      setError("Failed to load team data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUserAddress]);

  useEffect(() => {
    fetchTeamData();
  }, [campaignId, fetchTeamData]);

  const handleInviteMember = useCallback(async () => {
    if (!inviteEmail.trim()) {
      setError("Email cannot be empty");
      return;
    }

    try {
      const newInvitation: PendingInvitation = {
        code: `inv_${Math.random().toString(36).substr(2, 9)}`,
        invitee: inviteEmail,
        role: inviteRole,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        accepted: false,
      };

      setPendingInvitations((prev: PendingInvitation[]) => [...prev, newInvitation]);
      setInviteEmail("");
      setError(null);
      setSuccessMessage(`Invitation sent to ${inviteEmail}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to send invitation");
      console.error(err);
    }
  }, [inviteEmail, inviteRole, onTeamUpdate]);

  const handleRemoveMember = useCallback(
    async (address: string) => {
      try {
        setTeamMembers((prev: TeamMember[]) => prev.filter((m: TeamMember) => m.address !== address));
        setMemberToRemove(null);
        setSuccessMessage("Member removed successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
        onTeamUpdate?.();
      } catch (err) {
        setError("Failed to remove member");
        console.error(err);
      }
    },
    [onTeamUpdate],
  );

  const handleCreateDelegation = useCallback(async () => {
    if (!delegateAddress.trim()) {
      setError("Address cannot be empty");
      return;
    }

    try {
      const expiresAt =
        Date.now() + parseInt(delegateDuration, 10) * 24 * 60 * 60 * 1000;
      const newDelegation: RoleDelegate = {
        delegator: currentUserAddress,
        delegatee: delegateAddress,
        role: delegateRole,
        expiresAt,
        isActive: true,
      };

      setDelegations((prev: RoleDelegate[]) => [...prev, newDelegation]);
      setDelegateAddress("");
      setError(null);
      setSuccessMessage("Delegation created successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to create delegation");
      console.error(err);
    }
  }, [
    currentUserAddress,
    delegateAddress,
    delegateDuration,
    delegateRole,
    onTeamUpdate,
  ]);

  const handleRevokeDelegation = useCallback(
    async (delegatee: string) => {
      try {
        setDelegations((prev: RoleDelegate[]) => prev.filter((d: RoleDelegate) => d.delegatee !== delegatee));
        setMemberToRevokeDelegation(null);
        setSuccessMessage("Delegation revoked successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
        onTeamUpdate?.();
      } catch (err) {
        setError("Failed to revoke delegation");
        console.error(err);
      }
    },
    [onTeamUpdate],
  );

  const copyInvitationCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const isOwner = teamMembers.some(
    (m: TeamMember) => m.address === currentUserAddress && m.role === "Owner",
  );
  const isAdmin =
    isOwner ||
    teamMembers.some(
      (m: TeamMember) => m.address === currentUserAddress && m.role === "Admin",
    );

  return {
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
  };
}
