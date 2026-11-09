# RiderHub 360 — API Documentation Reference

This document catalogs all Route Handler API endpoints in RiderHub 360, including required parameters, authorization scopes, request payloads, and response structures.

---

## 1. Authentication & Session Endpoints

### `POST /api/auth/login`
Authenticates user, establishes a 7-day session cookie, and returns user roles and organizations.
- **Access:** Public
- **Body:** `{ email: string, password: string }`
- **Response:** `{ user: { id, email, fullName, platformRole }, orgs: [...], chairStations: [...] }`

### `POST /api/auth/logout`
Terminates the active session and clears the session cookie.
- **Access:** Authenticated
- **Response:** `{ ok: true }`

### `GET /api/me`
Retrieves currently logged-in user profile, permissions, and active subscriptions.
- **Access:** Authenticated
- **Response:** `{ user, orgs, chairStations }`

---

## 2. Platform Administration Endpoints (Super Admin Only)

### `GET /api/platform/overview`
Platform-wide statistics: total associations, active subscriptions, total members, stations, revenue.
- **Access:** `super_admin` only

### `GET /api/platform/orgs/[id]/detail`
Full tenant audit profile: subscription state, station list, official assignments, payment history.
- **Access:** `super_admin` only

### `POST /api/platform/orgs/[id]`
Update tenant association status (`active`, `suspended`, `cancelled`).
- **Access:** `super_admin` only
- **Body:** `{ status: string }`

### `POST /api/platform/payments/[id]/verify`
Manual approval of subscription payment and immediate subscription activation.
- **Access:** `super_admin` only
- **Body:** `{ action: "approve" | "reject", notes?: string }`

---

## 3. Association Workspace Endpoints

### `GET /api/org/dashboard`
Returns tenant dashboard metrics (members, active, suspended, pending applications, station counts).
- **Access:** Association roles (`owner`, `admin`, `secretary`, `treasurer`) & assigned Chairpersons.

### `GET /api/org/settings` | `POST /api/org/settings`
Read or update organization branding (colors, motto, logo, contact information).
- **Access:** `owner`, `admin` only.

### `GET /api/org/audit`
Returns immutable audit logs for the association.
- **Access:** `owner` only.

---

## 4. Pickup Stations & Stage Officials

### `GET /api/stations` | `POST /api/stations`
List all stations under the association or create a new station (enforcing plan station limits).
- **Access:** `owner`, `admin`

### `GET /api/stations/[id]` | `PATCH /api/stations/[id]`
Retrieve or update station details, location, and assign a single active Chairperson.
- **Access:** `owner`, `admin` (Chairperson has read-only access to their own station).

### `GET /api/stations/[id]/invitation`
Generates or retrieves the active public registration token for the station.
- **Access:** `owner`, `admin`, `chairperson`

---

## 5. Public Registration & Verification

### `GET /api/join/[token]`
Validates registration token; returns association branding, station name, and custom field form definition.
- **Access:** Public

### `POST /api/join/[token]`
Submits a new rider registration application into the two-stage approval pipeline.
- **Access:** Public
- **Body:** `{ firstName, surname, phone, nationalId, bikeRegNo, bikeModel, customValues: {} }`

### `GET /api/verify/[membershipNo]`
Public QR verification endpoint returning minimal public identity confirmation.
- **Access:** Public
- **Response:** `{ verified: boolean, memberName, orgName, stationName, status, issuedAt }`

---

## 6. Two-Stage Membership Approval Engine

### `GET /api/applications`
Lists pending membership applications. Chairpersons see only their assigned station.
- **Access:** `owner`, `admin`, `chairperson`

### `POST /api/applications/[id]/recommend` (STAGE 1)
Station Chairperson review. Records physical recommendation with mandatory notes.
- **Access:** Assigned Station Chairperson only.
- **Body:** `{ decision: "recommended" | "not_recommended" | "changes_requested", notes: string }`

### `POST /api/applications/[id]/decide` (STAGE 2)
Association Owner or Admin final decision. Approves and executes atomic member creation.
- **Access:** `owner`, `admin` only.
- **Body:** `{ decision: "approved" | "rejected", rejectionReason?: string, notes?: string }`

---

## 7. Member Directory & Transfers

### `GET /api/members`
Search, filter, and paginate member directory. Chairpersons are filtered to their stage.
- **Access:** Association leadership.

### `POST /api/transfers`
Initiates an inter-station member relocation.
- **Access:** `owner`, `admin`
- **Body:** `{ memberId, toStationId, reason }`
