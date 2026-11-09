# RiderHub 360 — Security & Threat Assessment

This document outlines the security architecture, threat model, mitigation strategies, and compliance controls for RiderHub 360 in adherence with Kenya's Data Protection Act, 2019.

---

## 1. Threat Model & Security Controls

| Threat Scenario | Potential Impact | Severity | Implemented Mitigation / Control |
| :--- | :--- | :---: | :--- |
| **Cross-Tenant Data Leak** | Association A reads members or records of Association B. | **Critical** | Dual-layer enforcement: PostgreSQL RLS policies + Next.js server-side `assertOrg()` validation on every Route Handler. |
| **Unauthorized Station Snooping** | Exit 5 Chairperson views TRM Stage member contact details or applications. | **High** | Station-restricted RLS + backend `assertStation()` verification checking `access.chairStationId === targetStationId`. |
| **Unapproved Membership Creation** | Chairperson or bad actor bypasses association admin to activate members. | **Critical** | Single-transaction approval endpoint (`/api/applications/[id]/decide`) strictly requires `['owner', 'admin']` roles. |
| **Tampering with Public Registration**| Public applicant submits fake station IDs or attempts to join unauthorized stages. | **High** | Public join routes require a signed cryptographic token (`/join/[token]`). Association and station are resolved server-side from `registration_invitations`. |
| **Subscription Bypass / Limit Tampering**| Association creates 5,000 members while paying for a 100-member Starter tier. | **High** | Server-side `assertCapacity(orgId, 'members')` enforces plan limits before any new member insertion. |
| **Credential Hijacking / Session Replay**| Attacker steals authentication tokens to impersonate leadership. | **High** | 64-character cryptographically random session tokens, stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies with 7-day TTL and instant server revocation. |
| **Audit Log Tampering** | Corrupt official deletes proof of fraudulent member approval. | **Critical** | PostgreSQL table `rh_audit_logs` has zero `UPDATE` or `DELETE` RLS policies. It is an append-only ledger. |
| **Document / ID Photo Exposure** | Public scraper downloads national ID photos of bodaboda riders. | **Critical** | ID images stored in private storage buckets; served only via short-lived signed URLs to verified association officials. |

---

## 2. Kenya Data Protection Act, 2019 Compliance

RiderHub 360 processes personal data of Kenyan citizens (National ID, telephone numbers, residential areas, motorcycle logbook details). The system implements statutory data protection principles:

1. **Lawful Basis & Explicit Consent:**
   - Registration forms include an explicit statutory consent checkbox authorizing the association to process intake data for welfare and stage management.
2. **Data Minimization:**
   - Public verification endpoints (`/verify/[membershipNo]`) reveal only minimal verification data: Full Name, Association Name, Stage, Status (Active/Suspended), and Verification Timestamp. National ID numbers, phone numbers, and next-of-kin details are strictly redacted from public views.
3. **Purpose Limitation:**
   - Intake information collected for association membership cannot be exported or exposed across tenants.
4. **Right to Rectification & Deletion:**
   - Association administrators can update inaccurate records and archive former riders without deleting historical audit entries.
