'use client'

import { useState } from 'react'
import { login, signup } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: 'login' | 'signup') => {
    setLoading(true)
    setError(null)
    const form = document.getElementById('auth-form') as HTMLFormElement
    const formData = new FormData(form)
    
    const result = action === 'login' ? await login(formData) : await signup(formData)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Default form submission goes to login
    handleAction('login')
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-main)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>MessMate</h1>
          <p className="text-muted" style={{ marginTop: '8px' }}>Log in to your mess dashboard</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--red)', 
            padding: '12px', 
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Email Address</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
              placeholder="••••••••"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '12px', fontSize: '15px' }}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                const form = document.getElementById('auth-form') as HTMLFormElement
                if (form.reportValidity()) handleAction('login')
              }}
            >
              {loading ? 'Processing...' : 'Log In'}
            </button>
            <button 
              type="button"
              className="btn btn-secondary" 
              style={{ flex: 1, padding: '12px', fontSize: '15px' }}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                const form = document.getElementById('auth-form') as HTMLFormElement
                if (form.reportValidity()) handleAction('signup')
              }}
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
