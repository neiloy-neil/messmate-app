'use client'
import { useState, useRef } from 'react'
import { supabase, Member } from '@/lib/supabase'
import { toast } from './ToastProvider'
import * as XLSX from 'xlsx'

interface Props { month: string; onClose: () => void }

interface ImportData {
  members: string[]
  mealRows: { date: string; [name: string]: string | number }[]
  shoppingRows: { date: string; [name: string]: string | number }[]
  depositRows: { date: string; [name: string]: string | number }[]
  utilityRows: { memberName: string; description: string; amount: number; date: string }[]
}

export function ImportModal({ month, onClose }: Props) {
  const [preview, setPreview] = useState<ImportData | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)

  function processFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        setPreview(parseWorkbook(wb))
      } catch (err: any) {
        toast.error('Failed to read file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function parseWorkbook(wb: XLSX.WorkBook): ImportData {
    const result: ImportData = { members: [], mealRows: [], shoppingRows: [], depositRows: [], utilityRows: [] }

    function getRows(name: string) {
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toLowerCase().includes(name)) || '']
      return ws ? XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) : []
    }

    function parseSheet(rows: any[][]): { members: string[]; data: { date: string; [k: string]: any }[] } {
      let headerRow = -1, memberCols: { name: string; idx: number }[] = []
      rows.forEach((row, i) => {
        if (row?.some(c => String(c || '').toLowerCase() === 'date')) {
          headerRow = i
          row.forEach((c, ci) => {
            const s = String(c || '').trim()
            if (s && s.toLowerCase() !== 'date' && !s.toLowerCase().startsWith('name') && s.toLowerCase() !== 'total') {
              memberCols.push({ name: s, idx: ci })
            }
          })
        }
      })
      const dataRows: { date: string; [k: string]: any }[] = []
      if (headerRow < 0) return { members: [], data: [] }
      const dateIdx = rows[headerRow].findIndex(c => String(c || '').toLowerCase() === 'date')
      for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r]
        if (!row) continue
        const raw = row[dateIdx]
        if (!raw || String(raw).toLowerCase().includes('total')) break
        let ds = ''
        if (typeof raw === 'number') {
          ds = new Date(Math.round((raw - 25569) * 86400000)).toISOString().slice(0, 10)
        } else if (raw instanceof Date) {
          ds = raw.toISOString().slice(0, 10)
        }
        if (!ds) continue
        const entry: any = { date: ds }
        memberCols.forEach(m => { entry[m.name] = Number(row[m.idx]) || 0 })
        dataRows.push(entry)
      }
      return { members: memberCols.map(m => m.name), data: dataRows }
    }

    const mealSheet = parseSheet(getRows('meal'))
    result.members = mealSheet.members
    result.mealRows = mealSheet.data
    result.shoppingRows = parseSheet(getRows('shopping')).data
    result.depositRows = parseSheet(getRows('deposit')).data

    // Utility sheet
    const utilRows = getRows('utility')
    let uhdr = -1
    utilRows.forEach((r, i) => { if (r?.some(c => String(c || '').toLowerCase() === 'name')) uhdr = i })
    if (uhdr >= 0) {
      for (let r = uhdr + 1; r < utilRows.length; r++) {
        const row = utilRows[r]
        const name = String(row?.[3] || '').trim()
        const desc = String(row?.[4] || '').trim()
        const amt = Number(row?.[5]) || 0
        if (name && amt > 0) result.utilityRows.push({ memberName: name, description: desc || 'Utility', amount: amt, date: month + '-01' })
      }
    }
    return result
  }

  async function confirmImport() {
    if (!preview) return
    setLoading(true)
    try {
      // Upsert members
      const existingRes = await supabase.from('members').select('*')
      const existing: Member[] = existingRes.data || []
      const memberMap: Record<string, string> = {}
      existing.forEach(m => { memberMap[m.name.toLowerCase()] = m.id })

      for (const name of preview.members) {
        const key = name.toLowerCase()
        if (!memberMap[key]) {
          const { data } = await supabase.from('members').insert({ name }).select('id,name').single()
          if (data) memberMap[data.name.toLowerCase()] = data.id
        }
      }

      function getId(name: string) { return memberMap[name.toLowerCase()] }

      // Insert meals
      const mealInserts: any[] = []
      preview.mealRows.forEach(row => {
        preview.members.forEach(name => {
          const val = Number(row[name]) || 0
          const mid = getId(name)
          if (mid && val > 0) mealInserts.push({ member_id: mid, date: row.date, count: val })
        })
      })
      if (mealInserts.length) await supabase.from('meals').upsert(mealInserts, { onConflict: 'member_id,date' })

      // Insert shopping
      const shopInserts: any[] = []
      preview.shoppingRows.forEach(row => {
        preview.members.forEach(name => {
          const val = Number(row[name]) || 0
          const mid = getId(name)
          if (mid && val > 0) shopInserts.push({ member_id: mid, date: row.date, amount: val })
        })
      })
      if (shopInserts.length) await supabase.from('shopping').upsert(shopInserts, { onConflict: 'member_id,date' })

      // Insert deposits
      const depInserts: any[] = []
      preview.depositRows.forEach(row => {
        preview.members.forEach(name => {
          const val = Number(row[name]) || 0
          const mid = getId(name)
          if (mid && val > 0) depInserts.push({ member_id: mid, date: row.date, amount: val })
        })
      })
      if (depInserts.length) await supabase.from('deposits').upsert(depInserts, { onConflict: 'member_id,date' })

      // Insert utility
      const utilInserts = preview.utilityRows.map(u => ({
        member_id: getId(u.memberName), description: u.description, amount: u.amount, date: u.date,
      })).filter(u => u.member_id)
      if (utilInserts.length) await supabase.from('utility').insert(utilInserts)

      toast.success('Data imported successfully! ✓')
      onClose()
      window.location.reload()
    } catch (e: any) {
      toast.error('Import failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Import from Excel</div>
        <div className="modal-sub">Import your existing Mess Meal Management .xlsx file</div>

        <div
          ref={zoneRef}
          className="import-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); zoneRef.current?.classList.add('over') }}
          onDragLeave={() => zoneRef.current?.classList.remove('over')}
          onDrop={e => { e.preventDefault(); zoneRef.current?.classList.remove('over'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 44 }}>📥</div>
          <h3>Drop your Excel file here</h3>
          <p>or <strong style={{ color: 'var(--accent)', cursor: 'pointer' }}>browse to choose</strong></p>
          <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Supports .xlsx format</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />

        {preview && (
          <div style={{ marginTop: 16, background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Import Preview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>👥 Members: <strong>{preview.members.length}</strong></div>
              <div>🍽️ Meal rows: <strong>{preview.mealRows.length}</strong></div>
              <div>🛒 Shopping rows: <strong>{preview.shoppingRows.length}</strong></div>
              <div>💰 Deposit rows: <strong>{preview.depositRows.length}</strong></div>
              <div>🔧 Utility items: <strong>{preview.utilityRows.length}</strong></div>
            </div>
            {preview.members.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>Members: {preview.members.join(', ')}</div>}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {preview && preview.members.length > 0 && (
            <button className="btn btn-primary" onClick={confirmImport} disabled={loading}>
              {loading ? '⏳ Importing...' : '📥 Confirm Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
