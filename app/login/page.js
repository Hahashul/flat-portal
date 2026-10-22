'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const input = 'w-full border border-slate-300 rounded-xl px-4 py-3 bg-white mt-1'
const EYE = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
const EYE_OFF = 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Wrong email or password.')
      setLoading(false)
      return
    }
    router.replace('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="w-14 h-14 rounded-2xl bg-brand-600 text-white grid place-items-center text-2xl font-bold mx-auto">F</span>
          <h1 className="text-2xl font-bold mt-4">Flat Portal</h1>
          <p className="text-slate-500 text-sm mt-1">860 Shukrawar Peth</p>
        </div>

        <form onSubmit={handleLogin} className="card p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-semibold">Sign in to your account</h2>

          <label className="text-sm font-medium text-slate-700 block">Email
            <input type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>

          <label className="text-sm font-medium text-slate-700 block">Password
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className={input + ' pr-12'} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 mt-1 text-slate-500 hover:text-slate-900">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={showPw ? EYE_OFF : EYE} />
                </svg>
              </button>
            </div>
          </label>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading || !email.trim() || !password}
            className="btn-primary w-full !py-3">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          Forgot your password? Please contact the office.
        </p>
      </div>
    </main>
  )
}