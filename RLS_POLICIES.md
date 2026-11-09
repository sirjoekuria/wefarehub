# RiderHub 360 — PostgreSQL Row Level Security (RLS) Policies

This document outlines the PostgreSQL Row-Level Security (RLS) policies implemented on Supabase / PostgreSQL to guarantee tenant data isolation and station-level protection directly at the database engine level.

---

## 1. Authentication Context Helpers

In Supabase / PostgreSQL, the logged-in user is resolved from JWT claims or session state:

```sql
-- Helper function to return the authenticated user ID
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS integer AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer;
$$ LANGUAGE sql STABLE;

-- Helper to check if current user is platform super_admin
CREATE OR REPLACE FUNCTION auth.is_platform_super_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.current_user_id() AND platform_role = 'super_admin'
  );
$$ LANGUAGE sql STABLE;

-- Helper to check association membership & role
CREATE OR REPLACE FUNCTION auth.has_org_role(check_org_id integer, check_roles text[]) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = check_org_id 
      AND user_id = auth.current_user_id()
      AND role::text = ANY(check_roles)
  );
$$ LANGUAGE sql STABLE;

-- Helper to check assigned station for chairperson
CREATE OR REPLACE FUNCTION auth.get_chair_station_id(check_org_id integer) RETURNS integer AS $$
  SELECT s.id 
  FROM pickup_stations s
  JOIN station_officials o ON o.station_id = s.id
  WHERE s.org_id = check_org_id 
    AND o.user_id = auth.current_user_id()
    AND o.role = 'chairperson'
    AND o.status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

---

## 2. Table Security Policies

### 2.1 `organizations`
- **Read:** Platform Super Admins, or any user who has an active membership in the organization, or anyone for basic public metadata (slug, name, logo) via public join links.
- **Write / Update:** Platform Super Admins or Association `owner`.
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_policy" ON organizations
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.current_user_id())
    OR status = 'active' -- Public join/verify screens
  );

CREATE POLICY "org_update_policy" ON organizations
  FOR UPDATE USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(id, ARRAY['owner'])
  );
```

### 2.2 `pickup_stations`
- **Read:** Association owners/admins/members can view all stations; station chairpersons can view stations within their org.
- **Insert / Update / Delete:** Association `owner` and `admin` only.
```sql
ALTER TABLE pickup_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stations_select" ON pickup_stations
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin', 'secretary', 'treasurer'])
    OR id = auth.get_chair_station_id(org_id)
  );

CREATE POLICY "stations_modify" ON pickup_stations
  FOR ALL USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin'])
  );
```

### 2.3 `rh_members` (Strict Station-Restricted Policy)
- **Select:**
  - Association `owner`, `admin`, `secretary`, `treasurer`: Can read ALL members of the organization.
  - Station `chairperson`: Can read ONLY members where `rh_members.station_id = auth.get_chair_station_id(rh_members.org_id)`.
- **Insert / Update / Delete:** Association `owner` and `admin` only.
```sql
ALTER TABLE rh_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_policy" ON rh_members
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin', 'secretary', 'treasurer'])
    OR (
      -- Chairperson sees ONLY their assigned station:
      station_id = auth.get_chair_station_id(org_id)
    )
  );

CREATE POLICY "members_modify_policy" ON rh_members
  FOR ALL USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin'])
  );
```

### 2.4 `membership_applications`
- **Select:**
  - Association `owner`, `admin`: Can read all applications across all stations in the association.
  - Station `chairperson`: Can read ONLY applications targeted to their station (`station_id = auth.get_chair_station_id(org_id)`).
- **Update (Chair Recommendation):**
  - Station `chairperson`: Can update ONLY if `station_id = auth.get_chair_station_id(org_id)` and status is `submitted` or `chairperson_review`.
  - Association `owner` / `admin`: Full update privileges.
```sql
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apps_select_policy" ON membership_applications
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin'])
    OR station_id = auth.get_chair_station_id(org_id)
  );

CREATE POLICY "apps_chair_update_policy" ON membership_applications
  FOR UPDATE USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin'])
    OR (
      station_id = auth.get_chair_station_id(org_id)
      AND status IN ('submitted', 'chairperson_review', 'changes_requested')
    )
  );
```

### 2.5 `organization_subscriptions`
- **Select:** Platform Admins and Association `owner`, `admin`, `treasurer`.
- **Modify:** Platform Super Admin only (subscriptions are provisioned and verified centrally).
```sql
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_select_policy" ON organization_subscriptions
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner', 'admin', 'treasurer'])
  );

CREATE POLICY "subs_modify_policy" ON organization_subscriptions
  FOR ALL USING (
    auth.is_platform_super_admin()
  );
```

### 2.6 `rh_audit_logs`
- **Select:** Platform Admins for all records; Association `owner` for records where `org_id = user's org`.
- **Insert:** System services and authenticated sessions.
- **Update / Delete:** **FORBIDDEN (Immutable Log)**.
```sql
ALTER TABLE rh_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_policy" ON rh_audit_logs
  FOR SELECT USING (
    auth.is_platform_super_admin()
    OR auth.has_org_role(org_id, ARRAY['owner'])
  );

CREATE POLICY "audit_insert_policy" ON rh_audit_logs
  FOR INSERT WITH CHECK (true);

-- No update or delete policies created: rows are permanently append-only.
```
