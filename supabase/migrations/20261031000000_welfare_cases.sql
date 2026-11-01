-- Welfare Cases: tracks hospital admissions and bereavements
-- One active (open) case at a time is enforced by the application layer.
-- This migration is additive and safe to run on existing deployments.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_type') THEN
    CREATE TYPE case_type AS ENUM ('hospital', 'death');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status') THEN
    CREATE TYPE case_status AS ENUM ('open', 'closed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS welfare_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  case_type     case_type  NOT NULL,
  status        case_status NOT NULL DEFAULT 'open',
  description   text,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welfare_cases_status_idx ON welfare_cases(status);
CREATE INDEX IF NOT EXISTS welfare_cases_member_idx ON welfare_cases(member_id);

-- RLS: same pattern as other tables — authenticated admins only
ALTER TABLE welfare_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated admins can read welfare cases" ON welfare_cases;
CREATE POLICY "Authenticated admins can read welfare cases"
  ON welfare_cases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated admins can insert welfare cases" ON welfare_cases;
CREATE POLICY "Authenticated admins can insert welfare cases"
  ON welfare_cases FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated admins can update welfare cases" ON welfare_cases;
CREATE POLICY "Authenticated admins can update welfare cases"
  ON welfare_cases FOR UPDATE TO authenticated USING (true);

-- Anonymous access is revoked (RLS handles this, but explicit is clearer)
REVOKE ALL ON welfare_cases FROM anon;
GRANT SELECT, INSERT, UPDATE ON welfare_cases TO authenticated;
