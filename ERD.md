# RiderHub 360 — Entity Relationship Diagram (ERD)

This document diagrams the complete relational model of RiderHub 360, demonstrating tenant boundaries, station hierarchy, two-stage approvals, dynamic custom fields, and monetization.

---

## 1. Master Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ sessions : "authenticates via"
    users ||--o{ organization_memberships : "holds roles in"
    users ||--o{ station_officials : "serves as"
    users ||--o{ rh_audit_logs : "triggers"

    subscription_plans ||--o{ organization_subscriptions : "defines limits for"
    
    organizations ||--|| organization_subscriptions : "maintains"
    organizations ||--o{ organization_memberships : "has members"
    organizations ||--o{ pickup_stations : "operates"
    organizations ||--o{ rh_members : "registers"
    organizations ||--o{ member_custom_field_definitions : "configures"
    organizations ||--o{ membership_applications : "processes"
    organizations ||--o{ registration_invitations : "issues"
    organizations ||--o{ subscription_payments : "submits"
    organizations ||--o{ announcements : "publishes"
    organizations ||--o{ rh_audit_logs : "records"

    pickup_stations ||--o{ station_officials : "governed by"
    pickup_stations ||--o{ rh_members : "bases"
    pickup_stations ||--o{ membership_applications : "receives"
    pickup_stations ||--o{ registration_invitations : "binds to"
    pickup_stations ||--o{ membership_transfers : "source/destination of"

    rh_members ||--o{ member_custom_field_values : "stores custom data in"
    rh_members ||--|| membership_cards : "issued"
    rh_members ||--o{ membership_transfers : "relocates via"

    member_custom_field_definitions ||--o{ member_custom_field_values : "defines schema for"
    
    membership_applications ||--o{ rh_members : "promoted to on approval"
```

---

## 2. Structural Subsystem Relationships

### 2.1 Multi-Tenant Governance & Station Leadership

```mermaid
classDiagram
    class User {
        +int id
        +string email
        +string platform_role
        +string full_name
    }
    class Organization {
        +int id
        +string name
        +string slug
        +string code
        +string primary_color
        +org_status status
    }
    class OrganizationMembership {
        +int id
        +int org_id
        +int user_id
        +org_role role
    }
    class PickupStation {
        +int id
        +int org_id
        +string name
        +string code
    }
    class StationOfficial {
        +int id
        +int station_id
        +int user_id
        +station_role role
        +official_status status
    }

    User "1" --> "*" OrganizationMembership : participates in
    Organization "1" --> "*" OrganizationMembership : employs
    Organization "1" --> "*" PickupStation : owns
    PickupStation "1" --> "*" StationOfficial : assigns
    User "1" --> "*" StationOfficial : appointed as
```

### 2.2 Two-Stage Membership Approval Engine

```mermaid
flowchart TD
    A[Public Applicant] -->|Opens Station Link /join/token| B[Registration Invitation]
    B -->|Resolves Org & Station| C[Submit Application Form]
    C -->|status: 'submitted'| D[membership_applications]
    
    subgraph STAGE 1 : Chairperson Station Review
        D --> E{Assigned Station Chairperson}
        E -->|Verify Bike & Physical Stage| F[chair_notes + Recommendation]
        F -->|status: 'recommended' / 'not_recommended'| G[Pending Association Decision]
        F -->|status: 'changes_requested'| H[Applicant Correction]
        H --> D
    end

    subgraph STAGE 2 : Association Final Decision
        G --> I{Association Owner / Admin}
        I -->|Reject with Reason| J[status: 'rejected' + Log Reason]
        I -->|Approve| K[Atomically Execute Transaction]
        K --> L[Generate Unique Membership Number]
        K --> M[Insert rh_members Record]
        K --> N[Persist Custom Field Values]
        K --> O[Generate Digital Card & QR Code]
        K --> P[Audit Log & Push Notification]
    end
```

### 2.3 Dynamic Custom Field Schema

```mermaid
flowchart LR
    subgraph Organization Builder
        A[Admin Form Builder] -->|Defines Label, Key, Type, Required| B[member_custom_field_definitions]
    end
    
    subgraph Member Record
        C[Core Member Entity: rh_members]
        D[member_custom_field_values]
        B -->|Field Definition FK| D
        C -->|Member FK| D
    end
```
