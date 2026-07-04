'use client'
import { Suspense } from 'react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, Member } from '@/lib/supabase'
import { getDaysInMonth, formatDay, monthLabel, currentYM } from '@/lib/calculations'
import { MemberAvatar } from '@/components/MemberAvatar'
import { toast } from '@/components/ToastProvider'

interface Row { date: string; [memberId: string]: number | string }

function MealsPageInner() {
  const sp = useSearchParams()
  const month = sp.get('month') || currentYM()
  const [members, setMembers] = useState<Member[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, dataRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('meals').select('*').gte('date', `${month}-01`).lte('date', `${month}-${getDaysInMonth(month)}`),
    ])
    const mems: Member[] = mRes.data || []
    const data = dataRes.data || []
    const days = getDaysInMonth(month)
    const grid: Row[] = []
    for (let d = 1; d <= days; d++) {
      const date = formatDay(month, d)
      const row: Row = { date }
      mems.forEach(m => { row[m.id] = 0 })
      data.filter(r => r.date === date).forEach(r => { row[r.member_id] = Number(r.count) })
      grid.push(row)
    }
    setMembers(mems)
    setRows(grid)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  function handleChange(date: string, memberId: string, val: string) {
    setRows(prev => prev.map(r => r.date === date ? { ...r, [memberId]: val === '' ? 0 : Number(val) } : r))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(date, memberId, val === '' ? 0 : Number(val)), 600)
  }

  async function save(date: string, memberId: string, count: number) {
    if (count === 0) {
      await supabase.from('meals').delete().eq('member_id', memberId).eq('date', date)
    } else {
      await supabase.from('meals').upsert({ member_id: memberId, date, count }, { onConflict: 'member_id,date' })
    }
  }

  function getTotals() {
    const totals: Record<string, number> = {}
    members.forEach(m => { totals[m.id] = 0 })
    rows.forEach(r => members.forEach(m => { totals[m.id] += Number(r[m.id]) || 0 }))
    return totals
  }

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx')
    const header = ['Date', ...members.map(m => m.name), 'Total']
    const dataRows = rows.map(r => {
      let total = 0
      const cells = [r.date, ...members.map(m => { const v = Number(r[m.id]) || 0; total += v; return v || '' }), total || '']
      return cells
    })
    const totals = getTotals()
    const totalRow = ['Total', ...members.map(m => totals[m.id] || ''), Object.values(totals).reduce((a, b) => a + b, 0)]
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows, totalRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Meals')
    XLSX.writeFile(wb, `Meals_${month}.xlsx`)
    toast.success('Exported!')
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  const totals = getTotals()
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0)

  return (
    <div className="page">
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Meal Tracker</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{monthLabel(month)} — click any cell to edit</p>
        </div>
        <button className="btn btn-secondary" onClick={exportExcel}>📤 Export Excel</button>
      </div>

      {members.length === 0 ? (
        <div className="card"><div className="empty"><div className="icon">👥</div><h3>No members yet</h3><p>Add members first.</p></div></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {members.map((m, i) => (
                    <th key={m.id} className="text-center">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <MemberAvatar name={m.name} index={i} size={26} fontSize={10} />
                        {m.name}
                      </div>
                    </th>
                  ))}
                  <th className="text-center">Day Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  let dayTotal = 0
                  members.forEach(m => { dayTotal += Number(row[m.id]) || 0 })
                  return (
                    <tr key={row.date}>
                      <td className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      {members.map(m => (
                        <td key={m.id} className="text-center">
                          <input
                            type="number" min={0} max={10} step={0.5}
                            className="cell-input"
                            value={Number(row[m.id]) || ''}
                            placeholder="0"
                            onChange={e => handleChange(row.date, m.id, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-center font-bold" style={{ color: 'var(--teal)' }}>
                        {dayTotal > 0 ? dayTotal : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td style={{ fontWeight: 700 }}>Total</td>
                  {members.map(m => (
                    <td key={m.id} className="text-center" style={{ color: 'var(--accent)' }}>{totals[m.id] || 0}</td>
                  ))}
                  <td className="text-center" style={{ color: 'var(--accent)' }}>{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MealsPage() {
  return <Suspense fallback={<div className="page"><div className="spinner" /></div>}><MealsPageInner /></Suspense>
}
