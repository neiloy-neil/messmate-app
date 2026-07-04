import { Member, Meal, Shopping, Deposit, Utility } from './supabase'

export interface MemberSummary {
  member: Member
  meals: number
  shopping: number
  deposit: number
  utilityShare: number
  mealCost: number
  totalDue: number
  balance: number
}

export interface MonthSummary {
  members: MemberSummary[]
  totalMeals: number
  totalShopping: number
  totalDeposit: number
  totalUtility: number
  mealRate: number
}

export function computeSummary(
  members: Member[],
  meals: Meal[],
  shopping: Shopping[],
  deposits: Deposit[],
  utilities: Utility[]
): MonthSummary {
  const memberMap: Record<string, MemberSummary> = {}

  members.forEach(m => {
    memberMap[m.id] = {
      member: m,
      meals: 0,
      shopping: 0,
      deposit: 0,
      utilityShare: 0,
      mealCost: 0,
      totalDue: 0,
      balance: 0,
    }
  })

  meals.forEach(r => {
    if (memberMap[r.member_id]) memberMap[r.member_id].meals += Number(r.count)
  })
  shopping.forEach(r => {
    if (memberMap[r.member_id]) memberMap[r.member_id].shopping += Number(r.amount)
  })
  deposits.forEach(r => {
    if (memberMap[r.member_id]) memberMap[r.member_id].deposit += Number(r.amount)
  })

  const totalMeals = Object.values(memberMap).reduce((s, d) => s + d.meals, 0)
  const totalShopping = Object.values(memberMap).reduce((s, d) => s + d.shopping, 0)
  const totalDeposit = Object.values(memberMap).reduce((s, d) => s + d.deposit, 0)
  const totalUtility = utilities.reduce((s, u) => s + Number(u.amount), 0)
  const mealRate = totalMeals > 0 ? totalShopping / totalMeals : 0
  const utilityShare = members.length > 0 ? totalUtility / members.length : 0

  Object.values(memberMap).forEach(d => {
    d.utilityShare = Math.ceil(utilityShare)
    d.mealCost = Math.ceil(d.meals * mealRate)
    d.totalDue = d.mealCost + d.utilityShare
    d.balance = d.deposit - d.totalDue
  })

  return {
    members: members.map(m => memberMap[m.id]),
    totalMeals,
    totalShopping,
    totalDeposit,
    totalUtility,
    mealRate,
  }
}

export interface Settlement {
  from: Member
  to: Member
  amount: number
}

export function computeSettlement(summaries: MemberSummary[]): Settlement[] {
  const givers = summaries
    .filter(s => s.balance < 0)
    .map(s => ({ member: s.member, amount: -s.balance }))
  const receivers = summaries
    .filter(s => s.balance > 0)
    .map(s => ({ member: s.member, amount: s.balance }))

  const settlements: Settlement[] = []
  let gi = 0, ri = 0
  while (gi < givers.length && ri < receivers.length) {
    const g = givers[gi], r = receivers[ri]
    const amt = Math.min(g.amount, r.amount)
    if (amt > 0.5) {
      settlements.push({ from: g.member, to: r.member, amount: Math.round(amt) })
    }
    g.amount -= amt
    r.amount -= amt
    if (g.amount < 0.5) gi++
    if (r.amount < 0.5) ri++
  }
  return settlements
}

// Month helpers
export function getDaysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function formatDay(ym: string, day: number): string {
  const [y, m] = ym.split('-')
  return `${y}-${m}-${String(day).padStart(2, '0')}`
}

export function monthLabel(ym: string): string {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

export function currentYM(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function fmt(n: number, decimals = 0): string {
  return '৳' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export const AVATAR_COLORS = [
  { bg: 'rgba(99,102,241,0.2)', color: '#6366f1' },
  { bg: 'rgba(20,184,166,0.2)',  color: '#14b8a6' },
  { bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  { bg: 'rgba(234,179,8,0.2)',  color: '#eab308' },
  { bg: 'rgba(239,68,68,0.2)',  color: '#ef4444' },
  { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
  { bg: 'rgba(34,197,94,0.2)',  color: '#22c55e' },
  { bg: 'rgba(236,72,153,0.2)', color: '#ec4899' },
]
