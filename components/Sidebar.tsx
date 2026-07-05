'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { monthLabel, currentYM } from '@/lib/calculations'
import { ImportModal } from './ImportModal'

const NAV = [
  { href: '/', icon: '📊', label: 'Dashboard', section: 'Overview' },
  { href: '/bills', icon: '🧾', label: 'Fixed Bills', section: 'Management' },
  { href: '/payments', icon: '💳', label: 'Payment History', section: null },
  { href: '/meals', icon: '🍽️', label: 'Meal Tracker', section: null },
  { href: '/shopping', icon: '🛒', label: 'Shopping Expense', section: null },
  { href: '/utility', icon: '🔧', label: 'Utility Expenses', section: null },
  { href: '/report', icon: '📋', label: 'Final Report', section: 'Reports' },
  { href: '/members', icon: '👥', label: 'Members', section: null },
]

const MOBILE_MAIN_NAV = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/meals', icon: '🍽️', label: 'Meals' },
  { href: '/report', icon: '📋', label: 'Report' }
]

const MOBILE_MORE_NAV = [
  { href: '/bills', icon: '🧾', label: 'Fixed Bills' },
  { href: '/payments', icon: '💳', label: 'Payments' },
  { href: '/shopping', icon: '🛒', label: 'Shopping' },
  { href: '/utility', icon: '🔧', label: 'Utility' },
  { href: '/members', icon: '👥', label: 'Members' },
]

function SidebarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showImport, setShowImport] = useState(false)
  const [showMobileMore, setShowMobileMore] = useState(false)

  const month = searchParams.get('month') || currentYM()

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  let lastSection = ''

  return (
    <>
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🍱</span>
          <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>MessMate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="month"
            className="month-input mobile-month"
            value={month}
            onChange={handleMonthChange}
          />
          <button 
            onClick={async () => {
              const { logout } = await import('@/app/login/actions')
              await logout()
            }}
            style={{ 
              background: 'var(--surface-sunken)', 
              border: '1px solid var(--border)', 
              color: 'var(--red)', 
              fontSize: '16px', 
              cursor: 'pointer', 
              padding: '6px 8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Log Out"
          >
            🚪
          </button>
        </div>
      </div>

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
        {MOBILE_MAIN_NAV.map(item => {
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
        <button
          className={`bottom-nav-link${showMobileMore ? ' active' : ''}`}
          onClick={() => setShowMobileMore(true)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span className="bottom-nav-icon">☰</span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {/* Mobile Drawer Overlay */}
      {showMobileMore && (
        <div className="mobile-drawer-overlay" onClick={() => setShowMobileMore(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>More Options</h3>
              <button onClick={() => setShowMobileMore(false)} className="drawer-close">✕</button>
            </div>
            
            <div className="mobile-drawer-grid">
              {MOBILE_MORE_NAV.map(item => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={'drawer-' + item.href}
                    href={`${item.href}?month=${month}`}
                    onClick={() => setShowMobileMore(false)}
                    className={`drawer-link${isActive ? ' active' : ''}`}
                  >
                    <span className="drawer-icon">{item.icon}</span>
                    <span className="drawer-label">{item.label}</span>
                  </Link>
                )
              })}
            </div>
            
            <div className="mobile-drawer-actions">
              <button className="btn-import" onClick={() => { setShowImport(true); setShowMobileMore(false); }}>
                📥 Import Excel
              </button>
              <button 
                className="btn-import" 
                style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
                onClick={async () => {
                  const { logout } = await import('@/app/login/actions')
                  await logout()
                }}
              >
                🚪 Log Out
              </button>
            </div>
          </div>
        </div>
      )}

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
