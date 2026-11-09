'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, Member, IndividualRent, SharedBills } from '@/lib/supabase'
import { monthLabel, currentYM, fmt } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'
import { useUserRole } from '@/lib/useUserRole'

function BillsPageInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const { isGuest, loading: roleLoading } = useUserRole()
  const month = sp.get('month') || currentYM()

  useEffect(() => {
    if (!roleLoading && isGuest) {
      router.replace('/')
    }
  }, [roleLoading, isGuest, router])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  
  // Shared bills state
  const [sharedBillId, setSharedBillId] = useState<string | null>(null)
  const [shared, setShared] = useState({
    gas: '', electricity: '', internet: '', water: '', cleaner: '', maid: ''
  })
  
  // Individual rent state: map of member_id to rent amount string & row ID
  const [rents, setRents] = useState<Record<string, string>>({})
  const [rentIds, setRentIds] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
    const [mRes, sbRes, irRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('shared_bills').select('*').eq('month', month).maybeSingle(),
      supabase.from('individual_rent').select('*').eq('month', month)
    ])
    
    const allMems = mRes.data || []
    setMembers(allMems.filter(m => !m.hidden_months?.includes(month)))
    
    if (sbRes.data) {
      setSharedBillId(sbRes.data.id)
      setShared({
        gas: sbRes.data.gas.toString(),
        electricity: sbRes.data.electricity.toString(),
        internet: sbRes.data.internet.toString(),
        water: sbRes.data.water.toString(),
        cleaner: sbRes.data.cleaner.toString(),
        maid: sbRes.data.maid.toString()
      })
    } else {
      setSharedBillId(null)
      setShared({ gas: '', electricity: '', internet: '', water: '', cleaner: '', maid: '' })
    }

    const rentMap: Record<string, string> = {}
    const idMap: Record<string, string> = {}
    if (irRes.data) {
      irRes.data.forEach((r: IndividualRent) => {
        rentMap[r.member_id] = r.amount.toString()
        idMap[r.member_id] = r.id
      })
    }
    setRents(rentMap)
    setRentIds(idMap)
    
    } finally {
      setLoading(false)
    }
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

    let error: any = null
    let targetId = sharedBillId

    if (!targetId) {
      const { data: existing } = await supabase
        .from('shared_bills')
        .select('id')
        .eq('month', month)
        .maybeSingle()
      if (existing?.id) {
        targetId = existing.id
        setSharedBillId(existing.id)
      }
    }

    if (targetId) {
      const res = await supabase.from('shared_bills').update(payload).eq('id', targetId)
      error = res.error
    } else {
      const res = await supabase.from('shared_bills').insert(payload).select('id').maybeSingle()
      const newId = (res.data as any)?.id
      if (newId) {
        setSharedBillId(newId)
      }
      error = res.error
    }

    if (error) toast.error('Failed to save bills: ' + error.message)
    else toast.success('Shared bills saved!')
  }

  async function saveRent(memberId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const amount = Number(rents[memberId]) || 0
    let targetId = rentIds[memberId]

    if (!targetId) {
      const { data: existing } = await supabase
        .from('individual_rent')
        .select('id')
        .eq('member_id', memberId)
        .eq('month', month)
        .maybeSingle()
      if (existing?.id) {
        targetId = existing.id
        setRentIds(prev => ({ ...prev, [memberId]: existing.id }))
      }
    }

    let error: any = null
    if (targetId) {
      const res = await supabase
        .from('individual_rent')
        .update({ amount })
        .eq('id', targetId)
      error = res.error
    } else {
      const payload = { user_id: user.id, member_id: memberId, month, amount }
      const res = await supabase
        .from('individual_rent')
        .insert(payload)
        .select('id')
        .maybeSingle()
      const newId = (res.data as any)?.id
      if (newId) {
        setRentIds(prev => ({ ...prev, [memberId]: newId }))
      }
      error = res.error
    }

    if (error) toast.error('Failed to save rent: ' + error.message)
    else toast.success('Rent updated!')
  }

  if (loading || roleLoading || isGuest) return <div className="page"><div className="spinner" /></div>

  const totalShared = 
    (Number(shared.gas)||0) + 
    (Number(shared.electricity)||0) + 
    (Number(shared.internet)||0) + 
    (Number(shared.water)||0) + 
    (Number(shared.cleaner)||0) + 
    (Number(shared.maid)||0)

  const residentMembers = members.filter(m => !m.is_meal_only)
  const splitAmount = residentMembers.length > 0 ? Math.ceil(totalShared / residentMembers.length) : 0

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
              <div className="card-sub">Total bills split equally among resident members</div>
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
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per Resident ({residentMembers.length})</div>
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
              <div className="card-sub">Specific rent amounts for resident members (meal-only members excluded)</div>
            </div>
          </div>

          {residentMembers.length === 0 ? (
            <div className="empty" style={{ padding: '20px' }}>No resident members found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {residentMembers.map((m, i) => (
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
