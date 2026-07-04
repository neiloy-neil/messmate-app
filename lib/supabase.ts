import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types ──────────────────────────────────────────────
export interface Member {
  id: string
  name: string
  created_at: string
}

export interface Meal {
  id: string
  member_id: string
  date: string
  count: number
  created_at: string
}

export interface Shopping {
  id: string
  member_id: string
  date: string
  amount: number
  created_at: string
}

export interface Deposit {
  id: string
  member_id: string
  date: string
  amount: number
  created_at: string
}

export interface Utility {
  id: string
  member_id: string
  description: string
  amount: number
  date: string
  created_at: string
}
