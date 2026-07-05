'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, getDaysInMonth, getPreviousMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { SettlementList } from '@/components/SettlementList'
import { toast } from '@/components/ToastProvider'

function ReportPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [members, setMembers] = useState<Member[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [rents, setRents] = useState<any[]>([])
  const [shared, setShared] = useState<any[]>([])
  const [previousBalances, setPreviousBalances] = useState<Record<string, number>>({})
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
    const prevMonth = getPreviousMonth(month)
    const pStart = `${prevMonth}-01`, pEnd = `${prevMonth}-${getDaysInMonth(prevMonth)}`

    const [
      m, ml, sh, dep, ut, ir, sb,
      prevBalsRes,
      currBalsRes
    ] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('meals').select('*').gte('date', start).lte('date', end),
      supabase.from('shopping').select('*').gte('date', start).lte('date', end),
      supabase.from('deposits').select('*').gte('date', start).lte('date', end),
      supabase.from('utility').select('*').gte('date', start).lte('date', end),
      supabase.from('individual_rent').select('*').eq('month', month),
      supabase.from('shared_bills').select('*').eq('month', month),
      // Fetch previous month's locked balances
      supabase.from('monthly_balances').select('*').eq('month', prevMonth),
      // Fetch current month's locked balances to see if already locked
      supabase.from('monthly_balances').select('*').eq('month', month)
    ])
    
    const membersList = m.data || []
    setMembers(membersList)
    setMeals(ml.data || [])
    setShopping(sh.data || [])
    setDeposits(dep.data || [])
    setUtilities(ut.data || [])
    setRents(ir.data || [])
    setShared(sb.data || [])

    // Map previous locked balances
    const pBals: Record<string, number> = {}
    if (prevBalsRes.data) {
      prevBalsRes.data.forEach((b: any) => {
        pBals[b.member_id] = Number(b.balance)
      })
    }
    setPreviousBalances(pBals)
    
    // Check if this month is already locked
    const isLocked = Boolean(currBalsRes.data && currBalsRes.data.length > 0)
    // We will need to set this in state
    setIsLocked(isLocked)
    
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities, rents, shared, previousBalances)

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx')
    const rows = [
      ['MessMate — Final Report'],
      [`Month: ${monthLabel(month)}`],
      [],
      ['Name', 'Meals', 'Meal Rate (৳)', 'Meal Cost (৳)', 'Misc Utility (৳)', 'Rent (৳)', 'Shared Bills (৳)', 'Prev Due (৳)', 'Late Fine (৳)', 'Total Due (৳)', 'Deposit (৳)', 'Balance (৳)'],
      ...summary.members.map(s => [s.member.name, s.meals, +summary.mealRate.toFixed(2), s.mealCost, s.utilityShare, s.rent, s.sharedBillShare, s.previousDue, s.lateFine, s.totalDue, s.deposit, s.balance]),
      [],
      ['Summary'],
      ['Total Meals', summary.totalMeals],
      ['Total Shopping', summary.totalShopping],
      ['Meal Rate', +summary.mealRate.toFixed(2)],
      ['Total Deposit', summary.totalDeposit],
      ['Total Misc Utility', summary.totalUtility],
      ['Total Rent', summary.totalRent],
      ['Total Shared Bills', summary.totalSharedBills],
      ['Total Late Fines', summary.totalLateFines],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Final Report')
    XLSX.writeFile(wb, `MessMate_Report_${month}.xlsx`)
    toast.success('Report exported!')
  }

  async function lockMonth() {
    if (!confirm(`Are you sure you want to lock the month of ${monthLabel(month)}? This will permanently save everyone's final carry-over balances.`)) return
    
    setLocking(true)
    const toInsert = summary.members.map(s => ({
      member_id: s.member.id,
      month: month,
      balance: s.balance
    }))
    
    const { error } = await supabase.from('monthly_balances').upsert(toInsert, { onConflict: 'member_id,month' })
    setLocking(false)
    
    if (error) {
      toast.error('Failed to lock month: ' + error.message)
    } else {
      toast.success('Month Locked! Balances saved.')
      setIsLocked(true)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const { totalMeals, totalShopping, totalDeposit, totalUtility, totalRent, totalSharedBills, mealRate, members: summaries } = summary
  const totalDue = summaries.reduce((s, x) => s + x.totalDue, 0)
  const netBalance = totalDeposit - totalDue

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>
            Final Report
            {isLocked && <span style={{ marginLeft: 8, fontSize: 12, background: 'var(--surface-sunken)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: 12, verticalAlign: 'middle' }}>🔒 Locked</span>}
          </h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} — complete financial summary</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end' }}>
          <button className="btn btn-primary" onClick={exportExcel}>📤 Export Excel</button>
          {!isLocked && (
            <button className="btn" style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)', width: '100%' }} onClick={lockMonth} disabled={locking}>
              {locking ? 'Locking...' : '🔒 Lock Month'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card teal">
          <div className="stat-hd"><div className="stat-label">Total Meals</div><div className="stat-icon teal">🍽️</div></div>
          <div className="stat-val">{totalMeals}</div>
          <div className="stat-sub">This month</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-hd"><div className="stat-label">Shopping</div><div className="stat-icon orange">🛒</div></div>
          <div className="stat-val">{fmt(totalShopping)}</div>
          <div className="stat-sub">Total grocery spend</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-hd"><div className="stat-label">Meal Rate</div><div className="stat-icon purple">📈</div></div>
          <div className="stat-val">{fmt(mealRate, 2)}</div>
          <div className="stat-sub">Per meal</div>
        </div>
        <div className="stat-card green">
          <div className="stat-hd"><div className="stat-label">Total Deposit</div><div className="stat-icon green">💰</div></div>
          <div className="stat-val">{fmt(totalDeposit)}</div>
          <div className="stat-sub">Collected</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-hd"><div className="stat-label">Fixed Bills</div><div className="stat-icon blue">🧾</div></div>
          <div className="stat-val">{fmt(totalRent + totalSharedBills)}</div>
          <div className="stat-sub">Rent & Shared</div>
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="card-title">Member Breakdown</div>
            <div className="card-sub">Meal cost, utility share, deposit and balance per member</div>
          </div>
        </div>
        <div className="table-wrap">
          {members.length === 0 ? (
            <div className="empty"><div className="icon">📋</div><h3>No data yet</h3><p>Add members and start tracking.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="text-center">Meals</th>
                  <th className="text-right">Meal Rate</th>
                  <th className="text-right">Meal Cost</th>
                  <th className="text-right">Rent</th>
                  <th className="text-right">Shared Bills</th>
                  <th className="text-right">Misc Util</th>
                  <th className="text-right">Prev Due</th>
                  <th className="text-right">Late Fine</th>
                  <th className="text-right">Total Due</th>
                  <th className="text-right">Deposit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => {
                  const bal = s.balance
                  return (
                    <tr key={s.member.id}>
                      <td><div className="member-row"><MemberAvatar name={s.member.name} index={i} /><span className="member-name">{s.member.name}</span></div></td>
                      <td className="text-center">{s.meals}</td>
                      <td className="text-right text-muted">{fmt(mealRate, 2)}</td>
                      <td className="text-right">{fmt(s.mealCost)}</td>
                      <td className="text-right">{fmt(s.rent)}</td>
                      <td className="text-right">{fmt(s.sharedBillShare)}</td>
                      <td className="text-right">{fmt(s.utilityShare)}</td>
                      <td className="text-right" style={{ color: s.previousDue > 0 ? 'var(--red)' : '' }}>{s.previousDue > 0 ? fmt(s.previousDue) : '-'}</td>
                      <td className="text-right" style={{ color: s.lateFine > 0 ? 'var(--red)' : '', fontWeight: s.lateFine > 0 ? 'bold' : 'normal' }}>{s.lateFine > 0 ? fmt(s.lateFine) : '-'}</td>
                      <td className="text-right font-bold">{fmt(s.totalDue)}</td>
                      <td className="text-right">{fmt(s.deposit)}</td>
                      <td className={`text-right font-bold ${bal >= 0 ? 'text-green' : 'text-red'}`} style={{ fontSize: 15 }}>
                        {bal >= 0 ? '+' : ''}{fmt(bal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td style={{ fontWeight: 700 }}>TOTAL</td>
                  <td className="text-center">{totalMeals}</td>
                  <td />
                  <td className="text-right">{fmt(summaries.reduce((s, x) => s + x.mealCost, 0))}</td>
                  <td className="text-right">{fmt(totalRent)}</td>
                  <td className="text-right">{fmt(totalSharedBills)}</td>
                  <td className="text-right">{fmt(totalUtility)}</td>
                  <td className="text-right">{fmt(summaries.reduce((s, x) => s + x.previousDue, 0))}</td>
                  <td className="text-right">{fmt(summary.totalLateFines)}</td>
                  <td className="text-right">{fmt(totalDue)}</td>
                  <td className="text-right">{fmt(totalDeposit)}</td>
                  <td className={`text-right font-bold ${netBalance >= 0 ? 'text-green' : 'text-red'}`} style={{ fontSize: 15 }}>
                    {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Settlement */}
      <div className="card">
        <div className="card-title mb-4">Settlement Plan</div>
        <div className="card-sub" style={{ marginBottom: 16 }}>Suggested transactions to settle all balances</div>
        <SettlementList summaries={summaries} />
      </div>
    </div>
  )
}

export default function ReportPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><ReportPageInner /></Suspense>
}
