'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { monthLabel, currentYM } from '@/lib/calculations'
import { ImportModal } from './ImportModal'

const NAV = [
  { href: '/', icon: '📊', label: 'Dashboard', section: 'Overview' },
  { href: '/bills', icon: '🧾', label: 'Fixed Bills', section: 'Management' },
  { href: '/meals', icon: '🍽️', label: 'Meal Tracker', section: null },
  { href: '/shopping', icon: '🛒', label: 'Shopping Expense', section: null },
  { href: '/utility', icon: '🔧', label: 'Utility Expenses', section: null },
  { href: '/report', icon: '📋', label: 'Final Report', section: 'Reports' },
  { href: '/members', icon: '👥', label: 'Members', section: null },
]

function SidebarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showImport, setShowImport] = useState(false)

  const month = searchParams.get('month') || currentYM()

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  let lastSection = ''

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">🍱</div>
            <div>
              <div className="logo-title">MessMate</div>
              <div className="logo-sub">Meal Management</div>
            </div>
          </div>
        </div>

        <div className="month-box">
          <div className="month-label">Current Month</div>
          <input
            type="month"
            className="month-input"
            value={month}
            onChange={handleMonthChange}
          />
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => {
            const showSection = item.section && item.section !== lastSection
            if (item.section) lastSection = item.section
            const isActive = pathname === item.href
            return (
              <div key={item.href}>
                {showSection && <div className="nav-section">{item.section}</div>}
                <Link
                  href={`${item.href}?month=${month}`}
                  className={`nav-link${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-import" onClick={() => setShowImport(true)}>
            📥 Import Excel
          </button>
          <button 
            className="btn-import" 
            style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={async () => {
              const { logout } = await import('@/app/login/actions')
              await logout()
            }}
          >
            🚪 Log Out
          </button>
        </div>
      </aside>

      <nav className="bottom-nav">
        {NAV.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={'bottom-' + item.href}
              href={`${item.href}?month=${month}`}
              className={`bottom-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {showImport && <ImportModal month={month} onClose={() => setShowImport(false)} />}
    </>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="sidebar" />}>
      <SidebarInner />
    </Suspense>
  )
}
