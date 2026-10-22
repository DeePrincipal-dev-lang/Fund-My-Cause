"use client";

import React from "react";
import type { Role } from "@/hooks/useTeamManagement";

export const ROLE_COLORS: Record<Role, string> = {
  Owner: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Editor:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  Contributor:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}
