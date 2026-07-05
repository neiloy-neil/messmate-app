'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, AVATAR_COLORS, getInitials, getDaysInMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

function MembersPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [members, setMembers] = useState<Member[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Edit State
  const [editPerms, setEditPerms] = useState({ can_add_meals: false, can_add_shopping: false, can_add_deposits: false })
  
  const [isManager, setIsManager] = useState(true)

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
    
    // Check if manager
    const { data: { user } } = await supabase.auth.getUser()
    if (user && m.data) {
       setIsManager(m.data.length === 0 || m.data[0].user_id === user.id)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities)

  async function addMember() {
    const n = name.trim()
    if (!n) { toast.error('Enter a name'); return }
    if (members.some(m => m.name.toLowerCase() === n.toLowerCase())) { toast.error('Member already exists'); return }
    setSaving(true)
    const payload: any = { name: n }
    if (email.trim()) payload.email = email.trim()
    const { error } = await supabase.from('members').insert(payload)
    setSaving(false)
    if (error) { toast.error('Failed: ' + error.message); return }
    setName('')
    setEmail('')
    setShowModal(false)
    toast.success(`${n} added ✓`)
    load()
  }

  async function updatePermissions() {
    if (!showEditModal) return
    setSaving(true)
    const { error } = await supabase.from('members').update({
      can_add_meals: editPerms.can_add_meals,
      can_add_shopping: editPerms.can_add_shopping,
      can_add_deposits: editPerms.can_add_deposits,
    }).eq('id', showEditModal.id)
    setSaving(false)
    if (error) { toast.error('Failed: ' + error.message); return }
    setShowEditModal(null)
    toast.success('Permissions updated')
    load()
  }

  async function deleteMember(id: string, memberName: string) {
    if (!confirm(`Remove ${memberName}? All their data for all months will be deleted.`)) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.info(`${memberName} removed`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Members</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} stats — manage your mess members</p>
        </div>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Member</button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">👥</div>
            <h3>No members yet</h3>
            <p>Click "Add Member" to add your first mess member.</p>
          </div>
        </div>
      ) : (
        <div className="members-grid">
          {summary.members.map((s, i) => {
            const bal = s.balance
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            return (
              <div key={s.member.id} className="member-card">
                <div className="mc-header">
                  <div
                    className="avatar"
                    style={{ width: 48, height: 48, fontSize: 20, background: color.bg, color: color.color }}
                  >
                    {getInitials(s.member.name)}
                  </div>
                  <div>
                    <div className="mc-name">{s.member.name}</div>
                    <div className="mc-since">Since {new Date(s.member.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
                <div className="mc-stats">
                  <div className="mc-stat">
                    <div className="mc-stat-val">{s.meals}</div>
                    <div className="mc-stat-label">Meals</div>
                  </div>
                  <div className="mc-stat">
                    <div className="mc-stat-val">{fmt(s.deposit)}</div>
                    <div className="mc-stat-label">Deposit</div>
                  </div>
                  <div className="mc-stat">
                    <div className="mc-stat-val">{fmt(s.totalDue)}</div>
                    <div className="mc-stat-label">Due</div>
                  </div>
                  <div className="mc-stat">
                    <div className={`mc-stat-val ${bal >= 0 ? 'text-green' : 'text-red'}`}>
                      {bal >= 0 ? '+' : ''}{fmt(bal)}
                    </div>
                    <div className="mc-stat-label">Balance</div>
                  </div>
                </div>
                <div className="mc-actions">
                  {isManager && (
                    <>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => {
                          setEditPerms({
                            can_add_meals: !!s.member.can_add_meals,
                            can_add_shopping: !!s.member.can_add_shopping,
                            can_add_deposits: !!s.member.can_add_deposits,
                          })
                          setShowEditModal(s.member)
                        }}
                      >
                        ⚙️ Permissions
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteMember(s.member.id, s.member.name)}>
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add New Member</div>
            <div className="modal-sub">Add a member to the mess</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input" type="text" placeholder="e.g. Farhad Ahmed"
                value={name} autoFocus
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address (Optional)</label>
              <input
                className="form-input" type="email" placeholder="Required if they want to log in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
              <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>If provided, they can sign up with this email to access their dashboard.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addMember} disabled={saving}>
                {saving ? '⏳ Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowEditModal(null)}>
          <div className="modal">
            <div className="modal-title">{showEditModal.name}'s Permissions</div>
            <div className="modal-sub">Toggle what they can do when logged in</div>
            
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={editPerms.can_add_meals} onChange={e => setEditPerms(p => ({...p, can_add_meals: e.target.checked}))} />
                <span style={{ fontSize: 14 }}>Can log their own daily meals</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={editPerms.can_add_shopping} onChange={e => setEditPerms(p => ({...p, can_add_shopping: e.target.checked}))} />
                <span style={{ fontSize: 14 }}>Can add grocery shopping expenses</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={editPerms.can_add_deposits} onChange={e => setEditPerms(p => ({...p, can_add_deposits: e.target.checked}))} />
                <span style={{ fontSize: 14 }}>Can request/add deposits</span>
              </label>
            </div>

            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={updatePermissions} disabled={saving}>
                {saving ? '⏳ Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MembersPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><MembersPageInner /></Suspense>
}
