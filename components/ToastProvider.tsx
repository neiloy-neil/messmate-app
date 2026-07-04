'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
interface ToastCtx { show: (msg: string, type?: Toast['type']) => void }

const Ctx = createContext<ToastCtx>({ show: () => {} })
export const useToast = () => useContext(Ctx)

let _show: ToastCtx['show'] = () => {}
export const toast = {
  success: (msg: string) => _show(msg, 'success'),
  error: (msg: string) => _show(msg, 'error'),
  info: (msg: string) => _show(msg, 'info'),
}

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' }

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + counter++
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  _show = show

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{ICONS[t.type]}</span> {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
