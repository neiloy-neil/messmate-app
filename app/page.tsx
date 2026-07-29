'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, getDaysInMonth, getPreviousMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { MealChart, BalanceChart } from '@/components/Charts'
import { SettlementList } from '@/components/SettlementList'
import { ToastProvider, toast } from '@/components/ToastProvider'
import Link from 'next/link'

function DashboardPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [rents, setRents] = useState<any[]>([])
  const [shared, setShared] = useState<any[]>([])
  const [previousBalances, setPreviousBalances] = useState<Record<string, number>>({})
  
  // Payment Modal State
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMember, setPaymentMember] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isPrevDuePayment, setIsPrevDuePayment] = useState(false)
  const [isManager, setIsManager] = useState(true)
  const [myPermissions, setMyPermissions] = useState({ can_add_meals: true, can_add_shopping: true, can_add_deposits: true })

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
    const prevMonth = getPreviousMonth(month)

    const [
      m, ml, sh, dep, ut, ir, sb, prevBalsRes
    ] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('meals').select('*').gte('date', start).lte('date', end),
      supabase.from('shopping').select('*').gte('date', start).lte('date', end),
      supabase.from('deposits').select('*').gte('date', start).lte('date', end),
      supabase.from('utility').select('*').gte('date', start).lte('date', end),
      supabase.from('individual_rent').select('*').eq('month', month),
      supabase.from('shared_bills').select('*').eq('month', month),
      supabase.from('monthly_balances').select('*').eq('month', prevMonth)
    ])
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const membersList = m.data || []
    setMembers(membersList)
    setMeals(ml.data || [])
    setShopping(sh.data || [])
    setDeposits(dep.data || [])
    setUtilities(ut.data || [])
    setRents(ir.data || [])
    setShared(sb.data || [])

    const pBals: Record<string, number> = {}
    if (prevBalsRes.data) {
      prevBalsRes.data.forEach((b: any) => {
        pBals[b.member_id] = Number(b.balance)
      })
    }
    setPreviousBalances(pBals)
    
    // Filter active members for this month
    const visibleMembers = membersList.filter(m => {
      const isHidden = m.hidden_months?.includes(month)
      if (!isHidden) return true
      const prevBal = pBals[m.id] || 0
      return prevBal < 0 // Show them if they owe money from previous months
    })
    setMembers(visibleMembers)
    
    // RBAC
    if (user && membersList) {
      const isMgr = membersList.length === 0 || membersList.some(m => m.auth_id === user.id && m.is_admin)
      setIsManager(isMgr)
      if (!isMgr) {
        const me = membersList.find(m => m.auth_id === user.id)
        if (me) {
          setMyPermissions({
            can_add_meals: !!me.can_add_meals,
            can_add_shopping: !!me.can_add_shopping,
            can_add_deposits: !!me.can_add_deposits,
          })
        }
      } else {
        setMyPermissions({ can_add_meals: true, can_add_shopping: true, can_add_deposits: true })
      }
    }
    
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities, rents, shared, previousBalances)

  async function handleReceivePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentMember || !paymentAmount) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setIsSaving(true)
    const now = new Date()
    const dStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const { error } = await supabase.from('deposits').insert({
      user_id: user.id,
      member_id: paymentMember,
      amount: Number(paymentAmount),
      date: dStr,
      is_prev_due: isPrevDuePayment
    })

    setIsSaving(false)
    if (!error) {
      toast.success('Payment received successfully')
      setShowPayment(false)
      setPaymentAmount('')
      setPaymentMember('')
      setIsPrevDuePayment(false)
      load()
    } else {
      toast.error('Failed to save payment: ' + error.message)
    }
  }


  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      {/* Topbar */}
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Dashboard</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} overview</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {myPermissions.can_add_deposits && (
            <button className="btn btn-secondary" style={{ borderColor: 'var(--green)' }} onClick={() => setShowPayment(true)}>💰 Receive</button>
          )}
          <Link href={`/report?month=${month}`} className="btn btn-primary">Report →</Link>
        </div>
      </div>

      {showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
          <div className="card" style={{ width: 400, maxWidth: '90%' }}>
            <h3 style={{ marginBottom: 16 }}>Receive Payment</h3>
            <form onSubmit={handleReceivePayment}>
              <div className="form-group">
                <label className="form-label">Member</label>
                <select className="form-input" value={paymentMember} onChange={e => setPaymentMember(e.target.value)} required>
                  <option value="">Select Member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount Paid (৳)</label>
                <input type="number" className="form-input" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <input type="checkbox" id="is_prev_due" checked={isPrevDuePayment} onChange={e => setIsPrevDuePayment(e.target.checked)} />
                <label htmlFor="is_prev_due" style={{ marginBottom: 0, fontWeight: 'normal' }}>This payment is to settle last month's due</label>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayment(false)} disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Caution / Info Banner */}
      {(() => {
        const hasDues = summary.members.some(s => s.previousDue > 0)
        const anyLate = summary.members.some(s => s.lateFine > 0)
        const today = new Date().getDate()
        
        let state = 'info'
        if (anyLate) state = 'error'
        else if (hasDues && today > 5) state = 'warning'

        const bg = state === 'error' ? 'rgba(239,68,68,0.1)' : (state === 'warning' ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.1)')
        const border = state === 'error' ? 'var(--red)' : (state === 'warning' ? 'var(--yellow)' : '#3b82f6')
        const icon = state === 'error' ? '⚠️' : (state === 'warning' ? '⏳' : 'ℹ️')
        const title = state === 'error' ? 'Action Required: Late Fines Active!' : (state === 'warning' ? 'Caution: Deadline Approaching!' : 'Payment Policy Reminder')
        const desc = state === 'error' 
          ? 'Some members have not settled their previous dues. A fine of 2 meals per day is actively being applied!'
          : (state === 'warning'
              ? 'Members must settle their previous dues by the 10th of this month to avoid a 2-meal daily late fine.'
              : 'Please remember to settle all previous dues by the 10th of the month. Delays will incur a 2-meal fine per day.')

        return (
          <div style={{ background: bg, border: `1px solid ${border}`, padding: '16px', borderRadius: '8px', marginBottom: '22px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', color: border, whiteSpace: 'normal', lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontSize: '14px', marginTop: '4px', whiteSpace: 'normal', lineHeight: 1.4 }}>{desc}</div>
            </div>
          </div>
        )
      })()}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-hd"><div className="stat-label">Members</div><div className="stat-icon purple">👥</div></div>
          <div className="stat-val">{members.length}</div>
          <div className="stat-sub">Active members</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-hd"><div className="stat-label">Total Meals</div><div className="stat-icon teal">🍽️</div></div>
          <div className="stat-val">{summary.totalMeals.toFixed(1)}</div>
          <div className="stat-sub">Served this month</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-hd"><div className="stat-label">Total Expense</div><div className="stat-icon orange">🛒</div></div>
          <div className="stat-val">{fmt(summary.totalShopping)}</div>
          <div className="stat-sub">Shopping this month</div>
        </div>
        <div className="stat-card green">
          <div className="stat-hd"><div className="stat-label">Meal Rate</div><div className="stat-icon green">📈</div></div>
          <div className="stat-val">{fmt(summary.mealRate, 2)}</div>
          <div className="stat-sub">Per meal</div>
        </div>
        <div className="stat-card red">
          <div className="stat-hd"><div className="stat-label">Total Deposit</div><div className="stat-icon red">💰</div></div>
          <div className="stat-val">{fmt(summary.totalDeposit)}</div>
          <div className="stat-sub">Collected this month</div>
        </div>
      </div>

      {/* Charts */}
      {members.length > 0 && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title mb-4">Meal Distribution</div>
            <div className="card-sub" style={{ marginBottom: 16 }}>Meals per member</div>
            <div className="chart-wrap"><MealChart summaries={summary.members} /></div>
          </div>
          <div className="card">
            <div className="card-title mb-4">Balance Summary</div>
            <div className="card-sub" style={{ marginBottom: 16 }}>Who owes / who gets back</div>
            <div className="chart-wrap"><BalanceChart summaries={summary.members} /></div>
          </div>
        </div>
      )}

      {/* Quick Summary Table */}
      <div className="card">
        <div className="card-hd">
          <div>
            <div className="card-title">Quick Summary</div>
            <div className="card-sub">Member balances at a glance</div>
          </div>
        </div>
        {members.length === 0 ? (
          <div className="empty">
            <div className="icon">👥</div>
            <h3>No members yet</h3>
            <p>Go to <Link href={`/members?month=${month}`} style={{ color: 'var(--accent)' }}>Members</Link> to add your first member.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Member</th>
                <th className="text-center">Meals</th>
                <th className="text-right">Previous Due</th>
                <th className="text-right">Late Fine</th>
                <th className="text-right">Current Due</th>
                <th className="text-right">Deposit</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {summary.members.map((s, i) => {
                  const bal = s.balance
                  const isLate = s.lateFine > 0
                  const isApproaching = s.previousDue > 0 && new Date().getDate() > 5 && new Date().getDate() <= 10 && !isLate

                  return (
                    <tr key={s.member.id}>
                      <td>
                        <div className="member-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MemberAvatar name={s.member.name} index={i} />
                          <span className="member-name">{s.member.name}</span>
                          {isLate && <span title="Late Fine Applied!" style={{ color: 'var(--red)', fontSize: '14px' }}>⚠️</span>}
                          {isApproaching && <span title="Settle by 10th to avoid fines!" style={{ color: 'var(--yellow)', fontSize: '14px' }}>⏳</span>}
                        </div>
                      </td>
                      <td className="text-center">{s.meals}</td>
                      <td className="text-right" style={{ color: s.previousDue > 0 ? 'var(--red)' : '' }}>{s.previousDue > 0 ? fmt(s.previousDue) : '-'}</td>
                      <td className="text-right" style={{ color: isLate ? 'var(--red)' : '', fontWeight: isLate ? 'bold' : 'normal' }}>{s.lateFine > 0 ? fmt(s.lateFine) : '-'}</td>
                      <td className="text-right">{fmt(s.totalDue)}</td>
                      <td className="text-right">{fmt(s.shopping + s.deposit)}</td>
                      <td className={`text-right font-bold ${bal >= 0 ? 'text-green' : 'text-red'}`}>
                        {bal >= 0 ? '+' : ''}{fmt(bal)}
                      </td>
                      <td>
                        <span className={`badge ${bal > 0 ? 'badge-green' : bal < 0 ? 'badge-red' : 'badge-yellow'}`}>
                          {bal > 0 ? 'Will receive' : bal < 0 ? 'Owes' : 'Settled'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><DashboardPageInner /></Suspense>
}
