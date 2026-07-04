'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, getDaysInMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { MealChart, BalanceChart } from '@/components/Charts'
import { SettlementList } from '@/components/SettlementList'
import Link from 'next/link'

function DashboardPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
    const [m, ml, sh, dep, ut] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('meals').select('*').gte('date', start).lte('date', end),
      supabase.from('shopping').select('*').gte('date', start).lte('date', end),
      supabase.from('deposits').select('*').gte('date', start).lte('date', end),
      supabase.from('utility').select('*').gte('date', start).lte('date', end),
    ])
    setMembers(m.data || [])
    setMeals(ml.data || [])
    setShopping(sh.data || [])
    setDeposits(dep.data || [])
    setUtilities(ut.data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities)

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      {/* Topbar */}
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Dashboard</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} overview</p>
        </div>
        <Link href={`/report?month=${month}`} className="btn btn-primary">View Full Report →</Link>
      </div>

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
                <th className="text-right">Total Cost</th>
                <th className="text-right">Deposit</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {summary.members.map((s, i) => {
                  const bal = s.balance
                  return (
                    <tr key={s.member.id}>
                      <td><div className="member-row"><MemberAvatar name={s.member.name} index={i} /><span className="member-name">{s.member.name}</span></div></td>
                      <td className="text-center">{s.meals}</td>
                      <td className="text-right">{fmt(s.totalDue)}</td>
                      <td className="text-right">{fmt(s.deposit)}</td>
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

      {/* Settlement Preview */}
      {summary.members.length > 0 && (
        <div className="card">
          <div className="card-title mb-4">Settlement Plan</div>
          <div className="card-sub" style={{ marginBottom: 16 }}>Suggested transactions to settle all balances</div>
          <SettlementList summaries={summary.members} />
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><DashboardPageInner /></Suspense>
}
