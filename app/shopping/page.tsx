'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Shopping } from '@/lib/supabase'
import { getDaysInMonth, monthLabel, currentYM, fmt } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

function ShoppingPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  
  const [members, setMembers] = useState<Member[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [formDate, setFormDate] = useState('')
  const [formMember, setFormMember] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formAmount, setFormAmount] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
    const [mRes, dataRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('shopping').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setMembers(mRes.data || [])
    setShopping(dataRes.data || [])
    
    // Default form date to today if in current month, else 1st of month
    const today = new Date()
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    if (month === todayMonth) {
      setFormDate(`${todayMonth}-${String(today.getDate()).padStart(2, '0')}`)
    } else {
      setFormDate(`${month}-01`)
    }
    
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formMember || !formDate || !formDesc || !formAmount) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('shopping').insert({
      user_id: user.id,
      member_id: formMember,
      date: formDate,
      description: formDesc,
      amount: Number(formAmount)
    })

    if (error) {
      toast.error('Error saving expense')
      console.error(error)
    } else {
      toast.success('Shopping expense added')
      setShowModal(false)
      setFormDesc('')
      setFormAmount('')
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shopping entry?')) return
    await supabase.from('shopping').delete().eq('id', id)
    load()
  }

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx')
    const rows = [
      ['Date', 'Member', 'Description', 'Amount (৳)'],
      ...shopping.map(s => {
        const m = members.find(x => x.id === s.member_id)
        return [s.date, m ? m.name : 'Unknown', s.description, s.amount]
      })
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Shopping')
    XLSX.writeFile(wb, `Shopping_${month}.xlsx`)
    toast.success('Exported!')
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const totalExpense = shopping.reduce((sum, s) => sum + Number(s.amount), 0)

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Shopping Expense</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} — track grocery purchases</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={exportExcel}>📤 Export</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>➕ Add Expense</button>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
          <div className="card" style={{ width: 400, maxWidth: '90%' }}>
            <h3 style={{ marginBottom: 16 }}>Add Shopping Expense</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Member</label>
                <select className="form-input" value={formMember} onChange={e => setFormMember(e.target.value)} required>
                  <option value="">Select Member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={formDate} onChange={e => setFormDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description (What was bought?)</label>
                <input type="text" className="form-input" placeholder="e.g. Chicken, Rice, Oil" value={formDesc} onChange={e => setFormDesc(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (৳)</label>
                <input type="number" step="0.01" min="0" className="form-input" placeholder="0" value={formAmount} onChange={e => setFormAmount(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card orange">
          <div className="stat-hd"><div className="stat-label">Total Expense</div><div className="stat-icon orange">🛒</div></div>
          <div className="stat-val">{fmt(totalExpense)}</div>
          <div className="stat-sub">Spent this month</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-hd"><div className="stat-label">Transactions</div><div className="stat-icon purple">🧾</div></div>
          <div className="stat-val">{shopping.length}</div>
          <div className="stat-sub">Purchases logged</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="card-title">Shopping Ledger</div>
        </div>
        
        {shopping.length === 0 ? (
          <div className="empty">
            <div className="icon">🛒</div>
            <h3>No expenses yet</h3>
            <p>Click "Add Expense" to start logging.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Date</th>
                  <th>Member</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {shopping.map((s) => {
                  const m = members.find(x => x.id === s.member_id)
                  const mIdx = members.findIndex(x => x.id === s.member_id)
                  
                  return (
                    <tr key={s.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      <td>
                        <div className="member-row">
                          {m ? <MemberAvatar name={m.name} index={mIdx} /> : null}
                          <span className="member-name">{m ? m.name : 'Unknown'}</span>
                        </div>
                      </td>
                      <td>{s.description}</td>
                      <td className="text-right font-bold text-orange">{fmt(s.amount)}</td>
                      <td className="text-center">
                        <button className="icon-btn" onClick={() => handleDelete(s.id)} title="Delete Expense">🗑️</button>
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

export default function ShoppingPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><ShoppingPageInner /></Suspense>
}

