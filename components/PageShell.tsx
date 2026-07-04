// Shared wrapper component that provides Suspense for useSearchParams
import { Suspense } from 'react'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="page"><div className="spinner" /></div>}>
      {children}
    </Suspense>
  )
}
