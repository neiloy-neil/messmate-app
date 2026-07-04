'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Utility } from '@/lib/supabase'
import { monthLabel, currentYM, fmt, getDaysInMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

function UtilityPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [members, setMembers] = useState<Member[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ memberId: '', description: '', amount: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, uRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('utility').select('*').gte('date', `${month}-01`).lte('date', `${month}-${getDaysInMonth(month)}`).order('created_at'),
    ])
    const mems = mRes.data || []
    setMembers(mems)
    setUtilities(uRes.data || [])
    if (mems.length > 0) setForm(f => ({ ...f, memberId: f.memberId || mems[0].id }))
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function addExpense() {
    if (!form.memberId) { toast.error('Select a member'); return }
    if (!form.description.trim()) { toast.error('Enter a description'); return }
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    const { error } = await supabase.from('utility').insert({
      member_id: form.memberId,
      description: form.description.trim(),
      amount,
      date: `${month}-01`,
    })
    if (error) { toast.error('Failed: ' + error.message); return }
    setForm(f => ({ ...f, description: '', amount: '' }))
    setShowModal(false)
    toast.success('Expense added ✓')
    load()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('utility').delete().eq('id', id)
    toast.info('Deleted')
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const total = utilities.reduce((s, u) => s + Number(u.amount), 0)
  const perPerson = members.length > 0 ? total / members.length : 0

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Utility Expenses</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} — medicine, cleaning supplies, gas, etc.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { if (members.length === 0) { toast.error('Add members first'); return } setShowModal(true) }}>
          + Add Expense
        </button>
      </div>

      {/* Summary */}
      {utilities.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card orange">
            <div className="stat-hd"><div className="stat-label">Total Utility</div><div className="stat-icon orange">🔧</div></div>
            <div className="stat-val">{fmt(total)}</div>
            <div className="stat-sub">{utilities.length} expense{utilities.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-hd"><div className="stat-label">Per Person</div><div className="stat-icon purple">👤</div></div>
            <div className="stat-val">{fmt(Math.ceil(perPerson))}</div>
            <div className="stat-sub">Split equally</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Member</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilities.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty">
                    <div className="icon">🔧</div>
                    <h3>No utility expenses</h3>
                    <p>Click "+ Add Expense" to record medicine, gas, cleaning etc.</p>
                  </div>
                </td></tr>
              ) : (
                utilities.map((u, i) => {
                  const memberIdx = members.findIndex(m => m.id === u.member_id)
                  const member = members[memberIdx]
                  return (
                    <tr key={u.id}>
                      <td className="text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div className="member-row">
                          {member && <MemberAvatar name={member.name} index={memberIdx >= 0 ? memberIdx : 0} size={26} fontSize={10} />}
                          <span className="member-name">{member?.name || '—'}</span>
                        </div>
                      </td>
                      <td>{u.description}</td>
                      <td className="text-right font-bold">{fmt(Number(u.amount))}</td>
                      <td className="text-right">
                        <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(u.id)}>🗑 Delete</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {utilities.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3} style={{ fontWeight: 700 }}>Total</td>
                  <td className="text-right font-bold">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Utility Expense</div>
            <div className="modal-sub">Record a miscellaneous expense</div>
            <div className="form-group">
              <label className="form-label">Member</label>
              <select className="form-input" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" type="text" placeholder="e.g. medicine, handwash, gas..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addExpense()} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (৳)</label>
              <input className="form-input" type="number" placeholder="0" min={0} step={0.01} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addExpense()} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addExpense}>Save Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UtilityPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><UtilityPageInner /></Suspense>
}
