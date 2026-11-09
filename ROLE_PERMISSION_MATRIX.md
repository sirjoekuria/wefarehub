# RiderHub 360 — Role & Permission Matrix

This document defines the Role-Based Access Control (RBAC) model across all platform, association, station, and member scopes.

---

## 1. Role Taxonomy & Scope

RiderHub 360 operates on three distinct, non-overlapping permission scopes:

1. **Platform Scope (`users.platform_role`):**
   - `super_admin`: Full platform control, tenant onboarding, subscription overrides, billing management, and embedded Welfare System management.
   - `support`: Platform read access and audit log inspection for operational support.

2. **Association Scope (`organization_memberships.role`):**
   - `owner`: Association creator; full operational, branding, financial, and administrative power within their workspace.
   - `admin`: Operational administrator; manages members, transfers, forms, station creation, and final application approvals.
   - `secretary`: Administrative officer; can view records, draft communications, and view registrations.
   - `treasurer`: Financial officer; views subscription status, financial summaries, and member directories.

3. **Station Scope (`station_officials.role`):**
   - `chairperson`: Single designated leader for a specific pickup station. Strict station-level data isolation.
   - `deputy_chairperson`: Assistant station leader.
   - `secretary`: Station clerical officer.

---

## 2. Comprehensive Permission Matrix

| Capability / Action | Platform Super Admin | Assoc Owner | Assoc Admin | Assoc Sec/Treas | Station Chair | Member (Public) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Platform Tenant Onboarding** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Subscription Plans** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manual Payment Verification** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Access Welfare System** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Customize Org Branding/Colors** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Configure Custom Field Builder** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create / Archive Pickup Stations**| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Appoint Station Officials** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Generate Station Join Links** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View All Association Members** | ✅ | ✅ | ✅ | ✅ | ❌ *(Station only)* | ❌ |
| **Stage 1: Chairperson Review** | ✅ | ❌ | ❌ | ❌ | ✅ *(Assigned only)* | ❌ |
| **Stage 2: Final Member Approval** | ✅ | ✅ | ✅ | ❌ | ❌ *(Denied)* | ❌ |
| **Initiate Member Transfer** | ✅ | ✅ | ✅ | ❌ | ❌ *(Denied)* | ❌ |
| **Issue Digital Member Card** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Verify Public QR Code** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Publish Org Announcements** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Export Association Reports** | ✅ | ✅ | ✅ | ✅ | ❌ *(Station only)* | ❌ |

---

## 3. Strict Station-Restricted Chairperson Enforcement

A core requirement is that **Station Chairpersons cannot view or alter other stations' records**:

```
                       ┌────────────────────────────┐
                       │  Station Chairperson Login │
                       │    (e.g., Exit 5 Stage)    │
                       └─────────────┬──────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
      [Assigned Station: Exit 5]         [Other Station: TRM Stage]
      ✅ View station member list        ❌ Access forbidden (403)
      ✅ Review incoming applicants      ❌ Application reviews blocked
      ✅ Record stage recommendation     ❌ Zero member record visibility
      ✅ View stage statistics           ❌ Station metrics hidden
```

### Backend Enforcement Mechanism (`src/lib/authz.ts`):
```typescript
export async function assertStation(
  userId: number,
  orgId: number,
  targetStationId: number
): Promise<void> {
  const access = await requireAccess(userId, orgId);
  // Association owners & admins have multi-station purview:
  if (access.role === "owner" || access.role === "admin") return;

  // Station officials are strictly bound to their station:
  if (access.chairStationId !== targetStationId) {
    throw new HttpError(403, "Access restricted to your assigned pickup station only.");
  }
}
```

### Prohibited Chairperson Actions:
- Cannot access `/api/org/settings` or edit association profile.
- Cannot grant final application approval (`POST /api/applications/[id]/decide` returns `403 Forbidden`).
- Cannot approve or initiate inter-station transfers.
- Cannot appoint themselves or others to leadership positions.
- Cannot alter subscription tiers or view billing credentials.
