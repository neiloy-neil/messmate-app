'use client'
import { MemberSummary, Settlement, computeSettlement, fmt } from '@/lib/calculations'
import { MemberAvatar } from './MemberAvatar'

export function SettlementList({ summaries }: { summaries: MemberSummary[] }) {
  const settlements = computeSettlement(summaries)
  const allSettled = summaries.every(s => Math.abs(s.balance) < 1)

  if (settlements.length === 0) {
    return (
      <div className="empty">
        <div className="icon">{allSettled ? '✅' : '📊'}</div>
        <h3>{allSettled ? 'All Settled!' : 'No settlements needed'}</h3>
        <p>{allSettled ? "Everyone's balance is clear." : 'Add data to see settlement suggestions.'}</p>
      </div>
    )
  }

  return (
    <div>
      {settlements.map((s, i) => {
        const fromIdx = summaries.findIndex(x => x.member.id === s.from.id)
        const toIdx = summaries.findIndex(x => x.member.id === s.to.id)
        return (
          <div key={i} className="settlement-item">
            <MemberAvatar name={s.from.name} index={fromIdx >= 0 ? fromIdx : 0} size={36} fontSize={14} />
            <div className="settle-info">
              <div className="settle-name">{s.from.name}</div>
              <div className="settle-role">Needs to pay</div>
            </div>
            <div className="settle-arrow">→</div>
            <MemberAvatar name={s.to.name} index={toIdx >= 0 ? toIdx : 0} size={36} fontSize={14} />
            <div className="settle-info">
              <div className="settle-name">{s.to.name}</div>
              <div className="settle-role">Will receive</div>
            </div>
            <div className="settle-amt">{fmt(s.amount)}</div>
          </div>
        )
      })}
    </div>
  )
}
