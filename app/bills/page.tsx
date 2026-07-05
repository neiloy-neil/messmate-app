'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, IndividualRent, SharedBills } from '@/lib/supabase'
import { monthLabel, currentYM, fmt } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

function BillsPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  
  // Shared bills state
  const [shared, setShared] = useState({
    gas: '', electricity: '', internet: '', water: '', cleaner: '', maid: ''
  })
  
  // Individual rent state: map of member_id to rent amount string
  const [rents, setRents] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, sbRes, irRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('shared_bills').select('*').eq('month', month).maybeSingle(),
      supabase.from('individual_rent').select('*').eq('month', month)
    ])
    
    const allMems = mRes.data || []
    setMembers(allMems.filter(m => !m.hidden_months?.includes(month)))
    
    if (sbRes.data) {
      setShared({
        gas: sbRes.data.gas.toString(),
        electricity: sbRes.data.electricity.toString(),
        internet: sbRes.data.internet.toString(),
        water: sbRes.data.water.toString(),
        cleaner: sbRes.data.cleaner.toString(),
        maid: sbRes.data.maid.toString()
      })
    } else {
      setShared({ gas: '', electricity: '', internet: '', water: '', cleaner: '', maid: '' })
    }

    const rentMap: Record<string, string> = {}
    if (irRes.data) {
      irRes.data.forEach((r: IndividualRent) => {
        rentMap[r.member_id] = r.amount.toString()
      })
    }
    setRents(rentMap)
    
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function saveSharedBills() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      month,
      gas: Number(shared.gas) || 0,
      electricity: Number(shared.electricity) || 0,
      internet: Number(shared.internet) || 0,
      water: Number(shared.water) || 0,
      cleaner: Number(shared.cleaner) || 0,
      maid: Number(shared.maid) || 0,
    }

    // Check if it exists first
    const { data: existing } = await supabase
      .from('shared_bills')
      .select('id')
      .eq('month', month)
      .maybeSingle()

    let error
    if (existing) {
      const res = await supabase.from('shared_bills').update(payload).eq('id', existing.id)
      error = res.error
    } else {
      const res = await supabase.from('shared_bills').insert(payload)
      error = res.error
    }

    if (error) toast.error('Failed to save bills: ' + error.message)
    else toast.success('Shared bills saved!')
  }

  async function saveRent(memberId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const amount = Number(rents[memberId]) || 0
    // Check if exists
    const { data: existing } = await supabase
      .from('individual_rent')
      .select('id')
      .eq('member_id', memberId)
      .eq('month', month)
      .maybeSingle()

    let error
    const payload = { user_id: user.id, member_id: memberId, month, amount }
    
    if (existing) {
      const res = await supabase.from('individual_rent').update(payload).eq('id', existing.id)
      error = res.error
    } else {
      const res = await supabase.from('individual_rent').insert(payload)
      error = res.error
    }

    if (error) toast.error('Failed to save rent')
    else toast.success('Rent updated!')
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const totalShared = 
    (Number(shared.gas)||0) + 
    (Number(shared.electricity)||0) + 
    (Number(shared.internet)||0) + 
    (Number(shared.water)||0) + 
    (Number(shared.cleaner)||0) + 
    (Number(shared.maid)||0)

  const splitAmount = members.length > 0 ? Math.ceil(totalShared / members.length) : 0

  return (
    <div className="page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Fixed Bills</h1>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} — Rent and shared mess utilities</p>
      </div>

      <div className="grid-2">
        {/* Shared Bills */}
        <div className="card">
          <div className="card-hd mb-4">
            <div>
              <div className="card-title">Shared Mess Bills</div>
              <div className="card-sub">Total bills split equally among all members</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Gas Bill (৳)</label>
              <input type="number" className="form-input" value={shared.gas} onChange={e => setShared(s => ({...s, gas: e.target.value}))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Electricity (৳)</label>
              <input type="number" className="form-input" value={shared.electricity} onChange={e => setShared(s => ({...s, electricity: e.target.value}))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Internet (৳)</label>
              <input type="number" className="form-input" value={shared.internet} onChange={e => setShared(s => ({...s, internet: e.target.value}))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Water (৳)</label>
              <input type="number" className="form-input" value={shared.water} onChange={e => setShared(s => ({...s, water: e.target.value}))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Cleaner (৳)</label>
              <input type="number" className="form-input" value={shared.cleaner} onChange={e => setShared(s => ({...s, cleaner: e.target.value}))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">Maid (৳)</label>
              <input type="number" className="form-input" value={shared.maid} onChange={e => setShared(s => ({...s, maid: e.target.value}))} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Shared Bills</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{fmt(totalShared)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per Person ({members.length})</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>{fmt(splitAmount)}</div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveSharedBills}>Save Shared Bills</button>
        </div>

        {/* Individual Rent */}
        <div className="card">
          <div className="card-hd mb-4">
            <div>
              <div className="card-title">Individual House Rent</div>
              <div className="card-sub">Specific rent amounts assigned to each member</div>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="empty" style={{ padding: '20px' }}>No members found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {members.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '8px 12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <MemberAvatar name={m.name} index={i} size={32} fontSize={12} />
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{m.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ width: '100px', padding: '6px 8px' }}
                      placeholder="Amount"
                      value={rents[m.id] || ''}
                      onChange={e => setRents(r => ({ ...r, [m.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveRent(m.id)}
                    />
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => saveRent(m.id)}>Save</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BillsPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><BillsPageInner /></Suspense>
}
