import { Member, Meal, Shopping, Deposit, Utility, IndividualRent, SharedBills } from './supabase'

export interface MemberSummary {
  member: Member
  meals: number
  shopping: number
  deposit: number
  utilityShare: number
  rent: number
  sharedBillShare: number
  mealCost: number
  previousDue: number
  lateFine: number
  totalDue: number
  balance: number
}

export interface MonthSummary {
  members: MemberSummary[]
  totalMeals: number
  totalShopping: number
  totalDeposit: number
  totalUtility: number
  totalRent: number
  totalSharedBills: number
  totalLateFines: number
  mealRate: number
}

export function computeSummary(
  members: Member[],
  meals: Meal[],
  shopping: Shopping[],
  deposits: Deposit[],
  utilities: Utility[],
  individualRents: IndividualRent[] = [],
  sharedBills: SharedBills[] = [],
  previousBalances: Record<string, number> = {},
  currentDayForFine: number = new Date().getDate()
): MonthSummary {
  const memberMap: Record<string, MemberSummary> = {}

  members.forEach(m => {
    // If balance was negative, they owed money. previousDue = -balance
    const prevBal = previousBalances[m.id] || 0
    const previousDue = prevBal < 0 ? -prevBal : 0

    memberMap[m.id] = {
      member: m,
      meals: 0,
      shopping: 0,
      deposit: 0,
      utilityShare: 0,
      rent: 0,
      sharedBillShare: 0,
      mealCost: 0,
      previousDue,
      lateFine: 0,
      totalDue: 0,
      balance: prevBal > 0 ? prevBal : 0, // carry forward positive balance
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
  individualRents.forEach(r => {
    if (memberMap[r.member_id]) memberMap[r.member_id].rent += Number(r.amount)
  })

  const totalMeals = Object.values(memberMap).reduce((s, d) => s + d.meals, 0)
  const totalShopping = Object.values(memberMap).reduce((s, d) => s + d.shopping, 0)
  const totalDeposit = Object.values(memberMap).reduce((s, d) => s + d.deposit, 0)
  const totalUtility = utilities.reduce((s, u) => s + Number(u.amount), 0)
  const totalRent = individualRents.reduce((s, r) => s + Number(r.amount), 0)
  
  const sb = sharedBills.length > 0 ? sharedBills[0] : null
  const totalSharedBills = sb ? (Number(sb.gas) + Number(sb.electricity) + Number(sb.internet) + Number(sb.water) + Number(sb.cleaner) + Number(sb.maid)) : 0

  const mealRate = totalMeals > 0 ? totalShopping / totalMeals : 0
  const utilityShare = members.length > 0 ? totalUtility / members.length : 0
  const sharedBillShare = members.length > 0 ? totalSharedBills / members.length : 0

  let totalLateFines = 0

  Object.values(memberMap).forEach(d => {
    // Late Fine Calculation
    if (d.previousDue > 0) {
      // Check deposits to see when they cleared it
      const memberDeps = deposits.filter(dep => dep.member_id === d.member.id).sort((a, b) => a.date.localeCompare(b.date))
      let accumulated = 0
      let paymentDay = currentDayForFine

      for (const dep of memberDeps) {
        accumulated += Number(dep.amount)
        if (accumulated >= d.previousDue) {
          paymentDay = parseInt(dep.date.split('-')[2])
          break
        }
      }
      
      const daysLate = Math.max(0, paymentDay - 11) // 12th = 1 day = 2 meals fine
      if (daysLate > 0) {
        d.lateFine = daysLate * (2 * mealRate)
        totalLateFines += d.lateFine
      }
    }

    d.utilityShare = Math.ceil(utilityShare)
    d.sharedBillShare = Math.ceil(sharedBillShare)
    d.mealCost = Math.ceil(d.meals * mealRate)
    
    // totalDue includes this month's expenses + previous due + late fines
    d.totalDue = d.mealCost + d.utilityShare + d.rent + d.sharedBillShare + d.previousDue + Math.ceil(d.lateFine)
    // balance = (carried over positive balance) + new deposit - totalDue
    d.balance = d.balance + d.deposit - d.totalDue
  })

  return {
    members: members.map(m => memberMap[m.id]),
    totalMeals,
    totalShopping,
    totalDeposit,
    totalUtility,
    totalRent,
    totalSharedBills,
    totalLateFines,
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

export function getPreviousMonth(ym: string): string {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
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
