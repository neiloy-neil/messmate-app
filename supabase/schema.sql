-- ============================================================
-- MessMate — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Drop existing tables (safe re-run)
DROP TABLE IF EXISTS utility CASCADE;
DROP TABLE IF EXISTS deposits CASCADE;
DROP TABLE IF EXISTS shopping CASCADE;
DROP TABLE IF EXISTS meals CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- Members table
CREATE TABLE members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meals table (daily meal count per member)
CREATE TABLE meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  count      NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- Shopping table (daily shopping spend per member)
CREATE TABLE shopping (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- Deposits table (money deposited by member per day)
CREATE TABLE deposits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- Utility table (miscellaneous expenses)
CREATE TABLE utility (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Enable Row Level Security (public access — no auth)
-- ============================================================
ALTER TABLE members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility  ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon role (single-mess, no auth)
CREATE POLICY "Public read members"  ON members  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read meals"    ON meals    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read shopping" ON shopping FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read deposits" ON deposits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read utility"  ON utility  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Enable Realtime for all tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE meals;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping;
ALTER PUBLICATION supabase_realtime ADD TABLE deposits;
ALTER PUBLICATION supabase_realtime ADD TABLE utility;
