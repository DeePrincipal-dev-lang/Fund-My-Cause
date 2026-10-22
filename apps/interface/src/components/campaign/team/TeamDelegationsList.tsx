"use client";

import React from "react";
import { Shield, X } from "lucide-react";
import type { Role, RoleDelegate } from "@/hooks/useTeamManagement";
import { RoleBadge } from "./RoleBadge";

interface TeamDelegationsListProps {
  isAdmin: boolean;
  delegations: RoleDelegate[];
  delegateAddress: string;
  delegateRole: Role;
  delegateDuration: string;
  onDelegateAddressChange: (val: string) => void;
  onDelegateRoleChange: (val: Role) => void;
  onDelegateDurationChange: (val: string) => void;
  onCreateDelegation: () => void;
  onSelectRevokeDelegation: (delegatee: string) => void;
}

const DELEGATION_ROLES: Role[] = ["Editor", "Viewer", "Contributor"];
const DELEGATION_DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const cardCls =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";
const inputCls =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

export function TeamDelegationsList({
  isAdmin,
  delegations,
  delegateAddress,
  delegateRole,
  delegateDuration,
  onDelegateAddressChange,
  onDelegateRoleChange,
  onDelegateDurationChange,
  onCreateDelegation,
  onSelectRevokeDelegation,
}: TeamDelegationsListProps) {
  const getDaysRemaining = (expiresAt: number) => {
    if (expiresAt === 0) return null;
    const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  return (
    <div className="space-y-4" role="tabpanel">
      {isAdmin && (
        <div className={cardCls}>
          <h3 className="mb-3 text-base font-semibold">Create Delegation</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              className={inputCls}
              placeholder="Delegatee address"
              aria-label="Delegatee address"
              value={delegateAddress}
              onChange={(e) => onDelegateAddressChange(e.target.value)}
            />
            <select
              className={inputCls}
              aria-label="Delegate role"
              value={delegateRole}
              onChange={(e) => onDelegateRoleChange(e.target.value as Role)}
            >
              {DELEGATION_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              aria-label="Delegation duration"
              value={delegateDuration}
              onChange={(e) => onDelegateDurationChange(e.target.value)}
            >
              {DELEGATION_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              onClick={onCreateDelegation}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              <Shield className="h-4 w-4" />
              Delegate
            </button>
          </div>
        </div>
      )}

      <div className={cardCls}>
        <h3 className="mb-3 text-base font-semibold">Active Delegations</h3>
        {delegations.length === 0 ? (
          <p className="text-gray-500">No active delegations</p>
        ) : (
          <div className="space-y-3">
            {delegations.map((delegation) => {
              const daysRemaining = getDaysRemaining(delegation.expiresAt);
              return (
                <div
                  key={delegation.delegatee}
                  data-testid={`delegation-${delegation.delegatee}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                        {delegation.delegatee.slice(0, 6)}...
                        {delegation.delegatee.slice(-4)}
                      </code>
                      <RoleBadge role={delegation.role} />
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Delegated by:{" "}
                      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                        {delegation.delegator.slice(0, 6)}...
                        {delegation.delegator.slice(-4)}
                      </code>
                      {daysRemaining && daysRemaining > 0
                        ? ` • Expires in ${daysRemaining} days`
                        : " • Expired"}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      aria-label={`Revoke delegation for ${delegation.delegatee}`}
                      onClick={() => onSelectRevokeDelegation(delegation.delegatee)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
