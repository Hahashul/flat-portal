'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const input = 'w-full border rounded-lg px-3 py-2 bg-white text-gray-900'
const btn = 'border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50'

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function NewCustomer() {
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState({})
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', password: '' })
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function load() {
    const [{ data: f }, { data: w }] = await Promise.all([
      supabase.from('flats').select('id, flat_no, wing_id, holder_name').is('customer_id', null),
      supabase.from('wings').select('id, name'),
    ])
    setWings(Object.fromEntries((w || []).map((x) => [x.id, x.name])))
    setFlats(f || [])
  }
  useEffect(() => {
    load()
    setForm((x) => ({ ...x, password: randomPassword() }))
  }, [])

  const toggle = (id) =>
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

  async function copy(text, key) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...form, flat_ids: picked }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Something went wrong')
    setResult(data)
    setShowPw(false)
    setPicked([])
    setForm({ email: '', full_name: '', phone: '', password: randomPassword() })
    load()
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Add customer login</h1>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
          {result.existing ? (
            <p>This person already had a login. The flats were added to it. Their password is unchanged.</p>
          ) : (
            <>
              <p className="font-medium">Login created. Send these details to the customer now. The password is not shown again.</p>
              <p>Email: <b>{result.email}</b></p>
              <p>Password: <b className="font-mono">{result.password}</b></p>
              <button type="button" className={btn}
                onClick={() => copy(`Email: ${result.email}\nPassword: ${result.password}`, 'result')}>
                {copied === 'result' ? 'Copied ✓' : 'Copy email & password'}
              </button>
            </>
          )}
        </div>
      )}

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-medium">Customer</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm col-span-2">Email (used to sign in)
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
          </label>
          <label className="text-sm">Name
            <input value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
          </label>
          <label className="text-sm">Phone
            <input value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
          </label>
          <div className="text-sm col-span-2">
            <label>Password (random, or type your own)
              <div className="relative">
                <input required minLength={8}
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={input + ' font-mono pr-12'} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-900">
                  {showPw ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            <div className="flex gap-2 mt-2">
              <button type="button" className={btn}
                onClick={() => setForm({ ...form, password: randomPassword() })}>Regenerate</button>
              <button type="button" className={btn}
                onClick={() => copy(form.password, 'pw')}>
                {copied === 'pw' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="text-gray-500 mt-1">Ignored if this email already has a login.</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-3">
        <h2 className="font-medium">Flats for this customer</h2>
        {flats.length === 0 ? (
          <p className="text-sm text-gray-500">Every flat already has a login.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {[...flats]
              .sort((a, b) => a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true }))
              .map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2">
                  <input type="checkbox" checked={picked.includes(f.id)} onChange={() => toggle(f.id)} />
                  <span>{wings[f.wing_id]}-{f.flat_no}{f.holder_name ? ` · ${f.holder_name}` : ''}</span>
                </label>
              ))}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={saving || picked.length === 0}
        className="bg-black text-white rounded-lg px-6 py-2 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create login'}
      </button>
    </form>
  )
}