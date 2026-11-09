# RiderHub 360 — Database Schema Reference

This document provides the complete PostgreSQL database schema definition for RiderHub 360, including table definitions, column types, primary keys, foreign key constraints, indexes, and tenancy ownership.

---

## 1. Schema Inventory

| Table Name | Description | Tenant Key |
| :--- | :--- | :--- |
| `users` | Platform user accounts & global roles | Global |
| `sessions` | Bearer cookie authentication sessions | `user_id` |
| `subscription_plans` | SaaS tier definitions (Starter, Growth, Pro, Enterprise) | Global |
| `organizations` | Tenant association profiles & branding | `id` |
| `organization_memberships` | User-to-organization RBAC mappings | `org_id` |
| `organization_subscriptions`| Tenant subscription state & billing period | `org_id` |
| `subscription_payments` | Manual / M-Pesa subscription payments | `org_id` |
| `pickup_stations` | Operational pickup stations (stages) | `org_id` |
| `station_officials` | Chairperson & station officials assignments | `station_id` |
| `rh_members` | Master member directory | `org_id`, `station_id` |
| `member_custom_field_definitions` | Dynamic field builder definitions | `org_id` |
| `member_custom_field_values` | Values for custom fields per member | Via `member_id` |
| `membership_applications` | Two-stage candidate intake applications | `org_id`, `station_id` |
| `registration_invitations`| Cryptographic station join tokens | `org_id`, `station_id` |
| `organization_officials` | Executive committee members | `org_id` |
| `membership_transfers` | Inter-station transfer audit trail | `org_id` |
| `membership_cards` | Digital card payloads & QR codes | `org_id`, `member_id` |
| `announcements` | Association & station notice board | `org_id` |
| `notifications` | In-app alerts for users | `user_id` |
| `rh_audit_logs` | Immutable audit trail of administrative actions| `org_id` |

---

## 2. Table Definitions

### 2.1 `users`
Global platform user identities.
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  platform_role TEXT, -- 'super_admin' | 'support' | NULL
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 `sessions`
Authentication sessions issued upon successful login.
```sql
CREATE TABLE sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
```

### 2.3 `subscription_plans`
Platform monetization tiers with resource limits.
```sql
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_price_kes NUMERIC(10,2) NOT NULL,
  annual_price_kes NUMERIC(10,2) NOT NULL,
  max_stations INTEGER NOT NULL,
  max_members INTEGER NOT NULL,
  max_admins INTEGER NOT NULL,
  storage_mb INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.4 `organizations`
Tenant entities representing individual associations.
```sql
CREATE TYPE org_status AS ENUM ('pending', 'active', 'suspended', 'cancelled');

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  motto TEXT,
  logo_url TEXT,
  primary_color VARCHAR(20) NOT NULL DEFAULT '#124E8A',
  secondary_color VARCHAR(20) NOT NULL DEFAULT '#10222E',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#F59F00',
  county VARCHAR(100),
  location TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  registration_number VARCHAR(100),
  description TEXT,
  status org_status NOT NULL DEFAULT 'pending',
  form_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX orgs_status_idx ON organizations(status);
```

### 2.5 `organization_memberships`
Role-based access mapping users to tenant organizations.
```sql
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'secretary', 'treasurer');

CREATE TABLE organization_memberships (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role org_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_memberships_unique UNIQUE (org_id, user_id)
);
CREATE INDEX org_mem_user_idx ON organization_memberships(user_id);
CREATE INDEX org_mem_org_idx ON organization_memberships(org_id);
```

### 2.6 `organization_subscriptions`
Tracks active subscription lifecycle, tier entitlements, and renewal deadlines.
```sql
CREATE TYPE subscription_status AS ENUM (
  'pending_payment', 'active', 'renewal_due', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired'
);
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');

CREATE TABLE organization_subscriptions (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'pending_payment',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  grace_period_end DATE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.7 `pickup_stations`
Pickup stages / stands under each association.
```sql
CREATE TABLE pickup_stations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  location TEXT,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pickup_stations_org_code_uniq UNIQUE (org_id, code)
);
CREATE INDEX stations_org_idx ON pickup_stations(org_id);
```

### 2.8 `station_officials`
Assigns leaders (Chairperson, Secretary, Deputy) to pickup stations.
```sql
CREATE TYPE station_role AS ENUM ('chairperson', 'secretary', 'deputy_chairperson');
CREATE TYPE official_status AS ENUM ('active', 'inactive');

CREATE TABLE station_officials (
  id SERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES pickup_stations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role station_role NOT NULL,
  status official_status NOT NULL DEFAULT 'active',
  appointed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX station_officials_single_active_chair
  ON station_officials(station_id)
  WHERE role = 'chairperson' AND status = 'active';
```

### 2.9 `rh_members`
Master association membership register.
```sql
CREATE TYPE member_status AS ENUM (
  'pending', 'active', 'suspended', 'inactive', 'transferred', 'deceased', 'archived'
);

CREATE TABLE rh_members (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES pickup_stations(id),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  phone TEXT,
  alt_phone TEXT,
  email TEXT,
  area TEXT,
  dob DATE,
  gender TEXT,
  national_id TEXT,
  photo_url TEXT,
  id_image_url TEXT,
  id_type TEXT,
  id_number TEXT,
  id_name TEXT,
  bike_reg_no TEXT,
  bike_model TEXT,
  bike_ownership TEXT,
  membership_number TEXT,
  existing_qr_id TEXT,
  status member_status NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'online',
  registration_date DATE,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rh_members_org_number_uniq UNIQUE (org_id, membership_number)
);
CREATE INDEX rh_members_org_idx ON rh_members(org_id, status);
CREATE INDEX rh_members_station_idx ON rh_members(station_id);
CREATE INDEX rh_members_phone_idx ON rh_members(org_id, phone);
```

### 2.10 `member_custom_field_definitions`
Configurable custom intake fields created by association administrators.
```sql
CREATE TYPE field_type AS ENUM (
  'text', 'number', 'date', 'dropdown', 'multi', 'checkbox', 'phone', 'file'
);

CREATE TABLE member_custom_field_definitions (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,
  label TEXT NOT NULL,
  type field_type NOT NULL DEFAULT 'text',
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'registration',
  help_text TEXT,
  form_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fdefs_org_key_uniq UNIQUE (org_id, key)
);
CREATE INDEX fdefs_org_idx ON member_custom_field_definitions(org_id, position);
```

### 2.11 `member_custom_field_values`
Values stored for custom fields attached to member records.
```sql
CREATE TABLE member_custom_field_values (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES rh_members(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES member_custom_field_definitions(id) ON DELETE CASCADE,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fvalues_member_field_uniq UNIQUE (member_id, field_id)
);
```

### 2.12 `membership_applications`
Intake table for the two-stage approval workflow.
```sql
CREATE TYPE application_status AS ENUM (
  'submitted', 'chairperson_review', 'recommended', 'not_recommended',
  'pending_final', 'approved', 'rejected', 'changes_requested'
);

CREATE TABLE membership_applications (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES pickup_stations(id),
  invitation_id INTEGER,
  full_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  area TEXT,
  national_id TEXT NOT NULL,
  bike_reg_no TEXT,
  bike_model TEXT,
  bike_ownership TEXT,
  photo_url TEXT,
  custom_values JSONB,
  status application_status NOT NULL DEFAULT 'submitted',
  chair_notes TEXT,
  recommended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recommended_at TIMESTAMPTZ,
  decision_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX apps_org_status_idx ON membership_applications(org_id, status);
CREATE INDEX apps_station_idx ON membership_applications(station_id);
```

### 2.13 `registration_invitations`
Secure tokens granting access to station-specific registration links.
```sql
CREATE TABLE registration_invitations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES pickup_stations(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.14 `membership_cards`
Digital card generation payloads with verification security codes.
```sql
CREATE TABLE membership_cards (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL UNIQUE REFERENCES rh_members(id) ON DELETE CASCADE,
  qr_payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.15 `membership_transfers`
Audit log of member relocations between stages.
```sql
CREATE TYPE transfer_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE membership_transfers (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES rh_members(id) ON DELETE CASCADE,
  from_station_id INTEGER NOT NULL REFERENCES pickup_stations(id),
  to_station_id INTEGER NOT NULL REFERENCES pickup_stations(id),
  reason TEXT NOT NULL,
  status transfer_status NOT NULL DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.16 `rh_audit_logs`
Immutable compliance trail for all platform and association activities.
```sql
CREATE TABLE rh_audit_logs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX rh_audit_org_idx ON rh_audit_logs(org_id, created_at);
```
