-- ============================================================
-- MessMate — Supabase Schema (Multi-Tenant)
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
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meals table (daily meal count per member)
CREATE TABLE meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  count      NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- Shopping table (transactional shopping spend per member)
CREATE TABLE shopping (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deposits table (money deposited by member per day)
CREATE TABLE deposits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- Utility table (miscellaneous expenses)
CREATE TABLE utility (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Fixed Bills
-- ============================================================

-- Individual Rent (specific rent per member per month)
CREATE TABLE individual_rent (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, month)
);

-- Shared Bills (total mess bills per month)
CREATE TABLE shared_bills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  gas         NUMERIC(10,2) NOT NULL DEFAULT 0,
  electricity NUMERIC(10,2) NOT NULL DEFAULT 0,
  internet    NUMERIC(10,2) NOT NULL DEFAULT 0,
  water       NUMERIC(10,2) NOT NULL DEFAULT 0,
  cleaner     NUMERIC(10,2) NOT NULL DEFAULT 0,
  maid        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- ============================================================
-- Enable Row Level Security (RLS)
-- ============================================================
ALTER TABLE members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility  ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_rent ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_bills    ENABLE ROW LEVEL SECURITY;

-- Allow users to only see and manage their own data
CREATE POLICY "Users can manage their own members"  ON members  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own meals"    ON meals    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own shopping" ON shopping FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own deposits" ON deposits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own utility"  ON utility  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own rent"     ON individual_rent FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own shared bills" ON shared_bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Enable Realtime for all tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE meals;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping;
ALTER PUBLICATION supabase_realtime ADD TABLE deposits;
ALTER PUBLICATION supabase_realtime ADD TABLE utility;
ALTER PUBLICATION supabase_realtime ADD TABLE individual_rent;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_bills;

