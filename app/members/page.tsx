'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, Member, Meal, Shopping, Deposit, Utility } from '@/lib/supabase'
import { computeSummary, monthLabel, currentYM, fmt, AVATAR_COLORS, getInitials, getDaysInMonth, getPreviousMonth } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'
import { useUserRole } from '@/lib/useUserRole'

function MembersPageInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const { isGuest, loading: roleLoading } = useUserRole()
  const month = sp.get('month') || currentYM()

  useEffect(() => {
    if (!roleLoading && isGuest) {
      router.replace('/')
    }
  }, [roleLoading, isGuest, router])
  const [members, setMembers] = useState<Member[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<Shopping[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [previousBalances, setPreviousBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isMealOnly, setIsMealOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  
  // Edit State
  const [editPerms, setEditPerms] = useState({ can_add_meals: false, can_add_shopping: false, can_add_deposits: false })
  const [editEmail, setEditEmail] = useState('')
  const [editIsMealOnly, setEditIsMealOnly] = useState(false)
  
  const [isManager, setIsManager] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const start = `${month}-01`, end = `${month}-${getDaysInMonth(month)}`
      const prevMonth = getPreviousMonth(month)
      const [m, ml, sh, dep, ut, prevBalsRes] = await Promise.all([
        supabase.from('members').select('*').order('created_at'),
        supabase.from('meals').select('*').gte('date', start).lte('date', end),
        supabase.from('shopping').select('*').gte('date', start).lte('date', end),
        supabase.from('deposits').select('*').gte('date', start).lte('date', end),
        supabase.from('utility').select('*').gte('date', start).lte('date', end),
        supabase.from('monthly_balances').select('*').eq('month', prevMonth)
      ])
      setMembers(m.data || [])
      setMeals(ml.data || [])
      setShopping(sh.data || [])
      setDeposits(dep.data || [])
      setUtilities(ut.data || [])
      const pBals = prevBalsRes.data ? Object.fromEntries(prevBalsRes.data.map((b:any) => [b.member_id, b.balance])) : {}
      setPreviousBalances(pBals)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && m.data) {
        setIsManager(m.data.length === 0 || m.data[0].user_id === user.id)
      }
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  const summary = computeSummary(members, meals, shopping, deposits, utilities, [], [], previousBalances)

  async function addMember() {
    const n = name.trim()
    if (!n) { toast.error('Enter a name'); return }
    if (members.some(m => m.name.toLowerCase() === n.toLowerCase())) { toast.error('Member already exists'); return }
    setSaving(true)
    const payload: any = { name: n, is_meal_only: isMealOnly }
    if (email.trim()) payload.email = email.trim()
    const { error } = await supabase.from('members').insert(payload)
    setSaving(false)
    if (error) { toast.error('Failed: ' + error.message); return }
    setName('')
    setEmail('')
    setIsMealOnly(false)
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
      email: editEmail.trim() || null,
      is_meal_only: editIsMealOnly,
    }).eq('id', showEditModal.id)
    setSaving(false)
    if (error) { toast.error('Failed: ' + error.message); return }
    setShowEditModal(null)
    toast.success('Permissions updated')
    load()
  }

  async function archiveMember(id: string, memberName: string, currentHidden: string[] = []) {
    if (!confirm(`Remove ${memberName} from this month (${month})? Their previous data will remain intact.`)) return
    const newHidden = [...new Set([...currentHidden, month])]
    const { error } = await supabase.from('members').update({ hidden_months: newHidden }).eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.info(`${memberName} removed from ${month}`)
    load()
  }

  async function restoreMember(id: string, memberName: string, currentHidden: string[] = []) {
    const newHidden = currentHidden.filter(m => m !== month)
    const { error } = await supabase.from('members').update({ hidden_months: newHidden }).eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.success(`${memberName} restored for ${month}`)
    load()
  }

  async function deleteMember(id: string, memberName: string) {
    if (!confirm(`HARD DELETE: Are you sure you want to completely destroy ${memberName} and wipe ALL their data across all months forever?`)) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.info(`${memberName} permanently destroyed`)
    load()
  }

  // Filter members based on toggle
  const visibleMembers = members.filter(m => {
    const isHidden = m.hidden_months?.includes(month)
    return showHidden ? true : !isHidden
  })

  if (loading || roleLoading || isGuest) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Members</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} stats — manage your mess members</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginRight: 10 }}>
            <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
            Show Hidden
          </label>
          {isManager && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Member</button>
          )}
        </div>
      </div>

      {visibleMembers.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">👥</div>
            <h3>No members yet</h3>
            <p>Click "Add Member" to add your first mess member.</p>
          </div>
        </div>
      ) : (
        <div className="members-grid">
          {summary.members.filter(s => visibleMembers.some(vm => vm.id === s.member.id)).map((s, i) => {
            const bal = s.balance
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const isHidden = s.member.hidden_months?.includes(month)

            return (
              <div key={s.member.id} className="member-card" style={{ opacity: isHidden ? 0.6 : 1 }}>
                <div className="mc-header">
                  <div
                    className="avatar"
                    style={{ width: 48, height: 48, fontSize: 20, background: color.bg, color: color.color }}
                  >
                    {getInitials(s.member.name)}
                  </div>
                  <div>
                    <div className="mc-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{s.member.name} {isHidden && '(Hidden)'}</span>
                      {s.member.is_meal_only && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', fontWeight: 600 }}>
                          Meal Only
                        </span>
                      )}
                    </div>
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
                <div className="mc-actions" style={{ flexWrap: 'wrap' }}>
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
                          setEditEmail(s.member.email || '')
                          setEditIsMealOnly(!!s.member.is_meal_only)
                          setShowEditModal(s.member)
                        }}
                      >
                        ⚙️ Perms
                      </button>
                      {isHidden ? (
                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => restoreMember(s.member.id, s.member.name, s.member.hidden_months)}>
                          ♻️ Restore
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => archiveMember(s.member.id, s.member.name, s.member.hidden_months)}>
                          🗑 Remove
                        </button>
                      )}
                      {isHidden && (
                         <button className="btn btn-danger btn-sm" title="Permanently Delete" onClick={() => deleteMember(s.member.id, s.member.name)}>
                           ⚠️ Destroy
                         </button>
                      )}
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
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={isMealOnly} 
                  onChange={e => setIsMealOnly(e.target.checked)} 
                  style={{ marginTop: 3 }}
                />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Meal-Only Member (Non-Resident)</span>
                  <p className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Exempt from house rent, shared mess bills, and utilities. Only pays for meals eaten.
                  </p>
                </div>
              </label>
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
            <div className="modal-title">{showEditModal.name}'s Profile & Permissions</div>
            <div className="modal-sub">Update their email or toggle what they can do</div>
            
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Email Address</label>
              <input
                className="form-input" type="email" placeholder="Required if they want to log in"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
              />
              <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Assign an email to allow them to log in.</p>
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 8 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={editIsMealOnly} 
                    onChange={e => setEditIsMealOnly(e.target.checked)} 
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Meal-Only Member (Non-Resident)</span>
                    <p className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      Exempt from house rent, shared bills, and utilities.
                    </p>
                  </div>
                </label>
              </div>
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
