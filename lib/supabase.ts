import { createClient } from '@/utils/supabase/client'

export const supabase = createClient()

// ── Types ──────────────────────────────────────────────
export interface Member {
  id: string
  user_id: string
  auth_id?: string
  email?: string
  name: string
  hidden_months?: string[]
  can_add_meals?: boolean
  can_add_shopping?: boolean
  can_add_deposits?: boolean
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
  description: string
  amount: number
  created_at: string
}

export interface Deposit {
  id: string
  user_id: string
  member_id: string
  date: string
  amount: number
  is_prev_due?: boolean
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

export interface IndividualRent {
  id: string
  member_id: string
  month: string
  amount: number
  created_at: string
}

export interface SharedBills {
  id: string
  user_id: string
  month: string
  gas: number
  electricity: number
  internet: number
  water: number
  cleaner: number
  maid: number
  created_at: string
}

export interface MonthlyBalance {
  id: string
  user_id: string
  member_id: string
  month: string
  balance: number
  created_at: string
}
