'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, getDaysInMonth, getPreviousMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
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
  const [fineAdjustments, setFineAdjustments] = useState<Record<string, number>>({})
  const [isLocked, setIsLocked] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)

  // Inline late-fine editing
  const [editingFine, setEditingFine] = useState<{ memberId: string; value: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
    const prevMonth = getPreviousMonth(month)

    const [m, ml, sh, dep, ut, ir, sb, prevBalsRes, currBalsRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('meals').select('*').gte('date', start).lte('date', end),
      supabase.from('shopping').select('*').gte('date', start).lte('date', end),
      supabase.from('deposits').select('*').gte('date', start).lte('date', end),
      supabase.from('utility').select('*').gte('date', start).lte('date', end),
      supabase.from('individual_rent').select('*').eq('month', month),
      supabase.from('shared_bills').select('*').eq('month', month),
      supabase.from('monthly_balances').select('*').eq('month', prevMonth),
      supabase.from('monthly_balances').select('*').eq('month', month),
    ])

    const membersList = m.data || []

    const pBals = prevBalsRes.data ? Object.fromEntries(prevBalsRes.data.map((b: any) => [b.member_id, b.balance])) : {}
    setPreviousBalances(pBals)

    const visibleMembers = membersList.filter(m => {
      const isHidden = m.hidden_months?.includes(month)
      if (!isHidden) return true
      return (pBals[m.id] || 0) < 0
    })
    setMembers(visibleMembers)
    setMeals(ml.data || [])
    setShopping(sh.data || [])
    setDeposits(dep.data || [])
    const allUtility = ut.data || []
    setUtilities(allUtility)
    setRents(ir.data || [])
    setShared(sb.data || [])
    setIsLocked(Boolean(currBalsRes.data && currBalsRes.data.length > 0))

    // Build fine adjustments map from utility entries tagged __fine_adj__
    const adjMap: Record<string, number> = {}
    allUtility.filter((u: any) => u.description === '__fine_adj__').forEach((u: any) => {
      adjMap[u.member_id] = Number(u.amount)
    })
    setFineAdjustments(adjMap)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && membersList.length > 0) {
      setIsManager(membersList.some(m => m.auth_id === user.id && m.is_admin) || membersList[0].user_id === user.id)
    } else if (user) {
      setIsManager(true)
    }

    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities, rents, shared, previousBalances, new Date().getDate(), fineAdjustments)

  async function saveFineAdjustment(memberId: string, newFine: number, autoFine: number) {
    const adjustment = newFine - autoFine
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Delete existing __fine_adj__ entry for this member/month, then insert new one
    await supabase.from('utility')
      .delete()
      .eq('member_id', memberId)
      .eq('description', '__fine_adj__')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)

    let error = null
    if (adjustment !== 0) {
      const res = await supabase.from('utility').insert({
        user_id: user.id,
        member_id: memberId,
        description: '__fine_adj__',
        amount: adjustment,
        date: `${month}-01`,
      })
      error = res.error
    }

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      setFineAdjustments(prev => ({ ...prev, [memberId]: adjustment }))
      toast.success('Late fine updated')
    }
    setEditingFine(null)
  }

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx')
    const rows = [
      ['MessMate — Final Report'],
      [`Month: ${monthLabel(month)}`],
      [],
      ['Name', 'Meals', 'Meal Rate (৳)', 'Meal Cost (৳)', 'Utility (৳)', 'Rent (৳)', 'Shared Bills (৳)', 'Prev Due (৳)', 'Late Fine (৳)', 'Total Due (৳)', 'Shopping (৳)', 'Deposit (৳)', 'Balance (৳)'],
      ...summary.members.map(s => [s.member.name, s.meals, +summary.mealRate.toFixed(2), s.mealCost, s.utilityShare, s.rent, s.sharedBillShare, s.previousDue, s.lateFine, s.totalDue, s.shopping, s.deposit, s.balance]),
      [],
      ['Summary'],
      ['Total Meals', summary.totalMeals],
      ['Total Shopping', summary.totalShopping],
      ['Meal Rate', +summary.mealRate.toFixed(2)],
      ['Total Deposit', summary.totalDeposit],
      ['Total Utility', summary.totalUtility],
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
    if (!confirm(`Are you sure you want to lock ${monthLabel(month)}? This will permanently save everyone's final carry-over balances.`)) return
    setLocking(true)
    const toInsert = summary.members.map(s => ({
      member_id: s.member.id,
      month,
      balance: s.balance
    }))
    const { error } = await supabase.from('monthly_balances').upsert(toInsert, { onConflict: 'member_id,month' })
    setLocking(false)
    if (error) toast.error('Failed to lock: ' + error.message)
    else { toast.success('Month Locked! Balances saved.'); setIsLocked(true) }
  }

  async function unlockMonth() {
    if (!confirm(`Unlock ${monthLabel(month)}? This removes the saved carry-over balances.`)) return
    setLocking(true)
    const { error } = await supabase.from('monthly_balances').delete().eq('month', month)
    setLocking(false)
    if (error) toast.error('Failed to unlock: ' + error.message)
    else { toast.success('Month Unlocked!'); setIsLocked(false) }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const { totalMeals, totalShopping, totalDeposit, totalUtility, totalRent, totalSharedBills, mealRate, members: summaries } = summary
  const totalDue = summaries.reduce((s, x) => s + x.totalDue, 0)
  const totalContributions = summaries.reduce((s, x) => s + x.shopping + x.deposit, 0)
  const netBalance = totalContributions - totalDue

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
          {!isLocked ? (
            <button className="btn" style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)', width: '100%' }} onClick={lockMonth} disabled={locking}>
              {locking ? 'Locking...' : '🔒 Lock Month'}
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={unlockMonth} disabled={locking}>
              {locking ? 'Unlocking...' : '🔓 Unlock Month'}
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
          <div className="stat-sub">Cash collected</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-hd"><div className="stat-label">Fixed Bills</div><div className="stat-icon blue">🧾</div></div>
          <div className="stat-val">{fmt(totalRent + totalSharedBills)}</div>
          <div className="stat-sub">Rent & Shared</div>
        </div>
      </div>

      {/* Member Breakdown Table */}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="card-title">Member Breakdown</div>
            <div className="card-sub">Meal cost, utility share, deposit and balance per member</div>
          </div>
          {isManager && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a late fine to edit</div>
          )}
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
                  <th className="text-right">Rent</th>
                  <th className="text-right">Shared Bills</th>
                  <th className="text-right">Utility Exp.</th>
                  <th className="text-right">Prev Due</th>
                  <th className="text-right">Late Fine</th>
                  <th className="text-right font-bold text-red">Payable Now</th>
                  <th className="text-right">Unbilled Meals</th>
                  <th className="text-right">Shopping</th>
                  <th className="text-right">Deposit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => {
                  const bal = s.balance
                  const autoFine = s.lateFine - s.lateFineAdjustment
                  const isEditing = editingFine?.memberId === s.member.id
                  return (
                    <tr key={s.member.id}>
                      <td><div className="member-row"><MemberAvatar name={s.member.name} index={i} /><span className="member-name">{s.member.name}</span></div></td>
                      <td className="text-center">{s.meals}</td>
                      <td className="text-right text-muted">{fmt(mealRate, 2)}</td>
                      <td className="text-right">{fmt(s.rent)}</td>
                      <td className="text-right">{fmt(s.sharedBillShare)}</td>
                      <td className="text-right">{fmt(s.utilityShare)}</td>
                      <td className="text-right" style={{ color: s.previousDue > 0 ? 'var(--red)' : '' }}>{s.previousDue > 0 ? fmt(s.previousDue) : '-'}</td>
                      <td className="text-right" style={{ color: s.lateFine > 0 ? 'var(--red)' : '', fontWeight: s.lateFine > 0 ? 'bold' : 'normal' }}>
                        {isManager && isEditing ? (
                          <input
                            type="number"
                            defaultValue={s.lateFine}
                            autoFocus
                            style={{ width: 80, padding: '2px 4px', background: 'var(--bg-main)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                            onBlur={e => saveFineAdjustment(s.member.id, Number(e.target.value), autoFine)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveFineAdjustment(s.member.id, Number((e.target as HTMLInputElement).value), autoFine)
                              if (e.key === 'Escape') setEditingFine(null)
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => isManager && setEditingFine({ memberId: s.member.id, value: String(s.lateFine) })}
                            style={{ cursor: isManager ? 'pointer' : 'default', textDecoration: isManager && s.lateFine > 0 ? 'underline dotted' : 'none' }}
                            title={isManager ? 'Click to override fine' : undefined}
                          >
                            {s.lateFine > 0 ? fmt(s.lateFine) : '-'}
                            {s.lateFineAdjustment !== 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>✏️</span>}
                          </span>
                        )}
                      </td>
                      <td className="text-right font-bold text-red" style={{ fontSize: 14 }}>{fmt(s.payableNow)}</td>
                      <td className="text-right text-muted">{fmt(s.unbilledMeals)}</td>
                      <td className="text-right" style={{ color: s.shopping > 0 ? 'var(--green)' : '' }}>{s.shopping > 0 ? fmt(s.shopping) : '-'}</td>
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
                  <td className="text-right">{fmt(totalRent)}</td>
                  <td className="text-right">{fmt(totalSharedBills)}</td>
                  <td className="text-right">{fmt(totalUtility)}</td>
                  <td className="text-right">{fmt(summaries.reduce((s, x) => s + x.previousDue, 0))}</td>
                  <td className="text-right">{fmt(summary.totalLateFines)}</td>
                  <td className="text-right font-bold text-red">{fmt(summary.totalPayableNow)}</td>
                  <td className="text-right text-muted">{fmt(summary.totalUnbilledMeals)}</td>
                  <td className="text-right">{fmt(totalShopping)}</td>
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
    </div>
  )
}

export default function ReportPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><ReportPageInner /></Suspense>
}
