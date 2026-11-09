# RiderHub 360 — System Architecture

**Product Name:** RiderHub 360  
**Version:** 1.0 (Production Architecture)  
**Target Market:** Kenya & Regional East Africa  
**Platform Category:** Multi-Tenant Bodaboda Association Management SaaS & Welfare Core  
**Runtime & Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, PostgreSQL / Supabase, PGlite  

---

## 1. Executive Architecture Summary

RiderHub 360 is a commercial multi-tenant software-as-a-service (SaaS) platform architected to allow independent bodaboda (motorcycle taxi) associations to digitize and govern their operations, pickup stations, stage leadership, member directories, identity verification, custom registrations, public QR card verifications, and financial reporting.

The system combines two unified systems into one cohesive platform:
1. **RiderHub 360 SaaS Platform:** Multi-tenant association management with dynamic branding, hierarchical pickup station governance, two-stage member approval, custom form builder, digital membership cards with QR codes, and paid subscription enforcement.
2. **Super Admin Welfare System:** The pre-existing Stanriders / ROCS CREW automated M-Pesa C2B contribution tracking, welfare case handling, and real-time bank/treasury reconciliation embedded directly inside the Super Admin Platform Console.

```
                      ┌──────────────────────────────────────┐
                      │            PUBLIC INGRESS            │
                      │  (Web Browser / Mobile Responsive)   │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
       ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
       │ Public Portals   │    │ Association Apps │    │ Platform Console │
       │ /join/[token]    │    │ /w/[slug]        │    │ /platform        │
       │ /verify/[id]     │    │ - Dashboard      │    │ - Tenant Mgt     │
       │ /card/[memberId] │    │ - Stations       │    │ - Plans & Subs   │
       │ /login           │    │ - Members/Transf │    │ - Welfare Embed  │
       │                  │    │ - Custom Fields  │    │ - Audit Logs     │
       └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
                │                       │                       │
                └───────────────────────┼───────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │   Next.js 16 App Router     │
                         │   Route Handlers & Authz    │
                         │   (requireUser, assertOrg)  │
                         └──────────────┬──────────────┘
                                        │
        ┌───────────────────────────────┴───────────────────────────────┐
        │                                                               │
        ▼                                                               ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     RiderHub 360 Database       │           │   Supabase Welfare Database     │
│   (PostgreSQL / Tenant Core)    │           │ (M-Pesa C2B, Cases, Members)    │
│  - 20 Tenant-Isolated Tables    │           │  - payments, pickup_points      │
│  - Row-Level Security (RLS)     │           │  - welfare_cases, audit_logs    │
│  - Custom Field Engine          │           │  - Real-time Supabase Webhooks  │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 2. Multi-Tenant Organization Model

The platform enforces strict three-tier structural tenancy:

```
  Tier 1: Platform Administration (Super Admin / Support)
    │
    ├── Tier 2: Organization Workspace (ROCS CREW, GKA, etc.)
    │     │
    │     ├── Tier 3: Pickup Station A (Exit 5 Stage - Chairperson Assigned)
    │     └── Tier 3: Pickup Station B (TRM Stage - Chairperson Assigned)
    │
    └── Tier 2: Organization Workspace (Githurai Kimwi Association)
          │
          ├── Tier 3: Pickup Station C (Kimwi Central Stage)
          └── Tier 3: Pickup Station D (Githurai 45 Stage)
```

1. **Platform Layer (`platform_role = 'super_admin'`):**
   - Owns tenant lifecycle: registers, verifies, suspends, and reinstates associations.
   - Manages SaaS subscription tiers, limits, and manual/automated payment verifications.
   - Accesses high-level platform analytics and audit logs across all tenants.
   - Hosts the embedded Welfare Contribution System.

2. **Association Layer (`organization_memberships`):**
   - Each association operates in a isolated workspace scoped by its unique `slug` (e.g., `/w/rocs-crew`).
   - Owns independent branding: custom logos, mottos, primary/secondary/accent color schemes.
   - Manages stations, appoints officials, configures membership forms, decides final applications, and handles member transfers.

3. **Pickup Station Layer (`pickup_stations`, `station_officials`):**
   - Granular base-level operational unit (stage/stand).
   - Each station has at most **one active Chairperson**.
   - Chairperson permissions are strictly station-scoped at both backend and RLS levels.

---

## 3. Core Architectural Decisions

### 3.1 Two-Stage Member Approval Engine
- **Stage 1 (Station Recommendation):** Station Chairperson verifies the applicant physically, checks motorcycle details, and records a status (`recommended`, `not_recommended`, or `changes_requested`) with mandatory notes.
- **Stage 2 (Association Final Decision):** Only Association Owners and Admins can finalize (`approved` or `rejected`). On approval, the system atomically assigns a sequential membership number, generates a digital membership card, creates verification QR links, and activates the member record in a single transaction.

### 3.2 Dynamic Configurable Membership Field Builder
- Associations require differing intake information (e.g., driving license number, helmet issue date, SACCO membership number) without changing core PostgreSQL table DDL.
- Modeled via `member_custom_field_definitions` and `member_custom_field_values`.
- Core immutable attributes (Name, National ID, Phone, Station, Motorcycle Plate) stay in the core `rh_members` table, while custom fields attach dynamically with versioned schemas.

### 3.3 Strict Station-Level Chairperson Security
- Chairpersons are bound to their assigned `station_id`.
- The authorization engine (`src/lib/authz.ts`) and database RLS verify `app.station_id === access.chairStationId`.
- Chairpersons cannot view private records of other stages, cannot reassign stages, and cannot grant final approval.

### 3.4 Paid SaaS Monetization from Launch
- Every association must have an active subscription (`organization_subscriptions`) linked to a plan (`subscription_plans`).
- Plans define hard caps: `max_stations`, `max_members`, `max_admins`, and `storage_mb`.
- When an association's subscription is `past_due`, `grace_period`, or `suspended`, write operations and new registrations are locked until rectified.

### 3.5 Unified 2-in-1 Architecture
- The Welfare Contribution Tracking System (M-Pesa C2B reconciliation, daily welfare claims, case approvals) runs directly alongside RiderHub 360.
- Super Admins can access Welfare via `/welfare` or directly inside `/platform` under the "Welfare System" tab.
