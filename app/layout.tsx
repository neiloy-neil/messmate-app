import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { ToastProvider } from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'MessMate — Mess Meal Management',
  description: 'Track meals, expenses, deposits, and generate final reports for your shared mess.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
        <ToastProvider />
      </body>
    </html>
  )
}
