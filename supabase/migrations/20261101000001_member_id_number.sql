-- Migration: Add National ID number to members table with uniqueness enforcement
ALTER TABLE members ADD COLUMN IF NOT EXISTS id_number TEXT;

-- Enforce uniqueness of non-null ID numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id_number ON members (id_number) WHERE id_number IS NOT NULL;

-- Validate format of Kenya National ID (6 to 10 digits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_id_number_format'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT member_id_number_format CHECK (id_number IS NULL OR id_number ~ '^[0-9]{6,10}$');
  END IF;
END $$;
