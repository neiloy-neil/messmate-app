'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Member, Deposit } from '@/lib/supabase'
import { currentYM } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

function PaymentHistoryPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [month])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [mRes, dRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('deposits').select('*').like('date', `${month}-%`).order('date', { ascending: false })
    ])
    
    if (mRes.data) setMembers(mRes.data)
    if (dRes.data) setDeposits(dRes.data)
    
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this payment?')) return
    const { error } = await supabase.from('deposits').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete payment: ' + error.message)
    } else {
      toast.info('Payment deleted successfully')
      load()
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Payment History</h1>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {deposits.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No payments received in {month}.
          </div>
        ) : (
          <div>
            {deposits.map((d, i) => {
              const mem = members.find(x => x.id === d.member_id)
              return (
                <div key={d.id} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '16px 20px', 
                  borderBottom: i < deposits.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MemberAvatar name={mem?.name || 'Unknown'} size={40} index={i} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{mem?.name || 'Unknown Member'}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Deposited on {d.date}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--green)' }}>
                      +৳{d.amount}
                    </div>
                    <button 
                      onClick={() => handleDelete(d.id)}
                      style={{ 
                        background: 'none', border: 'none', color: 'var(--red)', 
                        cursor: 'pointer', padding: '6px', fontSize: '18px', opacity: 0.8 
                      }}
                      title="Delete Payment"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

import { Suspense } from 'react'

export default function PaymentHistoryPage() {
  return (
    <Suspense fallback={<div className="page"><div className="spinner" /></div>}>
      <PaymentHistoryPageInner />
    </Suspense>
  )
}
