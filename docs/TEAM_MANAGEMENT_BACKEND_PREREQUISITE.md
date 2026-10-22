# Team Management API Prerequisite & Tracking Issue

## Status: Pending Backend / Smart Contract Implementation

### Context
`apps/interface/src/components/campaign/TeamManagement.tsx` provides the frontend UI for role-based access control (RBAC), team member invitations, and permission delegation. However, the component currently uses mock data in `fetchTeamData()` and updates local React state (`setTeamMembers`, `setPendingInvitations`, `setDelegations`) without persisting changes to a backend or smart contract.

---

### Required Backend API / Contract Specifications

To replace mock data in `TeamManagement.tsx` and make team management functional, the backend service (or Soroban smart contract) must provide the following endpoints:

#### 1. Team Members
- `GET /api/campaigns/:campaignId/team`
  - Returns list of `TeamMember`: `{ address: string, role: Role, addedAt: number, expiresAt: number, isActive: boolean }`.
- `DELETE /api/campaigns/:campaignId/team/:address`
  - Removes a team member from the campaign.

#### 2. Team Invitations
- `GET /api/campaigns/:campaignId/invitations`
  - Returns list of `PendingInvitation`: `{ code: string, invitee: string, role: Role, createdAt: number, expiresAt: number, accepted: boolean }`.
- `POST /api/campaigns/:campaignId/invitations`
  - Sends a team member invitation. Body: `{ invitee: string, role: Role }`.
- `POST /api/campaigns/:campaignId/invitations/:code/accept`
  - Accepts a pending invitation code.

#### 3. Role Delegations
- `GET /api/campaigns/:campaignId/delegations`
  - Returns list of `RoleDelegate`: `{ delegator: string, delegatee: string, role: Role, expiresAt: number, isActive: boolean }`.
- `POST /api/campaigns/:campaignId/delegations`
  - Creates a new role delegation. Body: `{ delegatee: string, role: Role, durationDays: number }`.
- `DELETE /api/campaigns/:campaignId/delegations/:delegatee`
  - Revokes an active role delegation.

---

### Action Items
- [ ] Implement backend REST/GraphQL API or Soroban contract storage for team roles, invitations, and delegations.
- [ ] Update `apps/interface/src/hooks/useTeamManagement.ts` to call these APIs via `@fund-my-cause/sdk` or API client once endpoints are live.
