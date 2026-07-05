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
  auth_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email      TEXT UNIQUE,
  name       TEXT NOT NULL,
  hidden_months TEXT[] DEFAULT '{}',
  can_add_meals BOOLEAN DEFAULT false,
  can_add_shopping BOOLEAN DEFAULT false,
  can_add_deposits BOOLEAN DEFAULT false,
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

CREATE TABLE deposits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_prev_due BOOLEAN DEFAULT false,
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

-- ============================================================
-- RBAC Helper Functions (Security Definer to bypass RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_manager_id() RETURNS UUID AS $$
  SELECT user_id FROM members WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_permission(perm_col TEXT) RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  EXECUTE format('SELECT %I FROM members WHERE auth_id = $1 LIMIT 1', perm_col)
  INTO has_perm USING auth.uid();
  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Drop old simple policies
-- ============================================================
DROP POLICY IF EXISTS "Users can manage their own members" ON members;
DROP POLICY IF EXISTS "Users can manage their own meals" ON meals;
DROP POLICY IF EXISTS "Users can manage their own shopping" ON shopping;
DROP POLICY IF EXISTS "Users can manage their own deposits" ON deposits;
DROP POLICY IF EXISTS "Users can manage their own utility" ON utility;
DROP POLICY IF EXISTS "Users can manage their own rent" ON individual_rent;
DROP POLICY IF EXISTS "Users can manage their own shared bills" ON shared_bills;

-- ============================================================
-- New Role-Based Policies
-- ============================================================

-- Members: Managers can do everything. Members can READ their group.
CREATE POLICY "Manager ALL, Member READ" ON members
  FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Manager ALL" ON members
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Meals: Manager ALL. Member READ. Member INSERT/UPDATE if permission.
CREATE POLICY "Meals READ" ON meals FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Meals MANAGER ALL" ON meals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Meals MEMBER INSERT" ON meals FOR INSERT WITH CHECK (user_id = get_my_manager_id() AND check_permission('can_add_meals'));
CREATE POLICY "Meals MEMBER UPDATE" ON meals FOR UPDATE USING (user_id = get_my_manager_id() AND check_permission('can_add_meals'));

-- Shopping: Manager ALL. Member READ. Member INSERT/UPDATE if permission.
CREATE POLICY "Shopping READ" ON shopping FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Shopping MANAGER ALL" ON shopping FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Shopping MEMBER INSERT" ON shopping FOR INSERT WITH CHECK (user_id = get_my_manager_id() AND check_permission('can_add_shopping'));
CREATE POLICY "Shopping MEMBER UPDATE" ON shopping FOR UPDATE USING (user_id = get_my_manager_id() AND check_permission('can_add_shopping'));

-- Deposits: Manager ALL. Member READ. Member INSERT/UPDATE if permission.
CREATE POLICY "Deposits READ" ON deposits FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Deposits MANAGER ALL" ON deposits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Deposits MEMBER INSERT" ON deposits FOR INSERT WITH CHECK (user_id = get_my_manager_id() AND check_permission('can_add_deposits'));
CREATE POLICY "Deposits MEMBER UPDATE" ON deposits FOR UPDATE USING (user_id = get_my_manager_id() AND check_permission('can_add_deposits'));

-- Utility & Bills & Balances (Manager ONLY for edits, Member READ)
CREATE POLICY "Utility READ" ON utility FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Utility MANAGER ALL" ON utility FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Rent READ" ON individual_rent FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Rent MANAGER ALL" ON individual_rent FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared Bills READ" ON shared_bills FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Shared Bills MANAGER ALL" ON shared_bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Month Locking (Final Balances)
-- ============================================================
CREATE TABLE monthly_balances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  balance    NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, month)
);
ALTER TABLE monthly_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Balances READ" ON monthly_balances FOR SELECT USING (auth.uid() = user_id OR user_id = get_my_manager_id());
CREATE POLICY "Balances MANAGER ALL" ON monthly_balances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_balances;

-- ============================================================
-- Auth Trigger: Auto-Link Member to Auth Account
-- ============================================================
-- Note: This trigger requires postgres superuser access or must be run in the Supabase UI.
-- It listens for new signups and links the auth_id to the member row with matching email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  UPDATE public.members
  SET auth_id = new.id
  WHERE email = new.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe creation of trigger (drop if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

