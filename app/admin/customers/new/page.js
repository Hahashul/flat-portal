'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const input = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white mt-1'

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

const EYE = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
const EYE_OFF = 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'

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
  const [search, setSearch] = useState('')

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

  const missing = []
  if (!form.email.trim()) missing.push('email')
  if (form.password.length < 8) missing.push('password (8+ characters)')
  if (picked.length === 0) missing.push('at least one flat')

  async function submit(e) {
    e.preventDefault()
    if (missing.length) return
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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

  const q = search.toLowerCase()
  const list = [...flats]
    .filter((f) => `${wings[f.wing_id]}-${f.flat_no} ${f.holder_name || ''}`.toLowerCase().includes(q))
    .sort((a, b) =>
      (wings[a.wing_id] || '').localeCompare(wings[b.wing_id] || '') ||
      a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true }))

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={saving || missing.length > 0} className="btn-primary">
        {saving ? 'Creating…' : 'Create login'}
      </button>
      {missing.length > 0 && (
        <p className="text-sm text-amber-700 basis-full">Still needed: {missing.join(', ')}</p>
      )}
    </div>
  )

  return (
    <form onSubmit={submit} className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">Add customer login</h1>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm space-y-2">
          {result.existing ? (
            <p>This person already had a login. The flats were added to it. Their password is unchanged.</p>
          ) : (
            <>
              <p className="font-semibold">Login created. Send these details now. The password is not shown again.</p>
              <p>Email: <b>{result.email}</b></p>
              <p>Password: <b className="font-mono">{result.password}</b></p>
              <button type="button" className="btn"
                onClick={() => copy(`Email: ${result.email}\nPassword: ${result.password}`, 'result')}>
                {copied === 'result' ? 'Copied ✓' : 'Copy email & password'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="font-semibold">Customer</h2>
            <label className="text-sm font-medium text-slate-700 block">Email (used to sign in) <span className="text-red-500">*</span>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-slate-700 block">Name
                <input value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
              </label>
              <label className="text-sm font-medium text-slate-700 block">Phone
                <input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
              </label>
            </div>
            <div className="text-sm">
              <label className="font-medium text-slate-700 block">Password <span className="text-red-500">*</span>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={input + ' font-mono pr-12'} />
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
              <div className="flex gap-2 mt-2">
                <button type="button" className="btn" onClick={() => setForm({ ...form, password: randomPassword() })}>Regenerate</button>
                <button type="button" className="btn" onClick={() => copy(form.password, 'pw')}>
                  {copied === 'pw' ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Random by default, or type your own. Ignored if this email already has a login.</p>
            </div>
          </section>
          <div className="hidden lg:block">{actions}</div>
        </div>

        <section className="card p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Flats for this customer <span className="text-red-500">*</span></h2>
            {picked.length > 0 && <span className="badge bg-brand-100 text-brand-700">{picked.length} selected</span>}
          </div>
          {flats.length === 0 ? (
            <p className="text-sm text-slate-500">Every flat already has a login.</p>
          ) : (
            <>
              <input placeholder="Search flat or holder" value={search}
                onChange={(e) => setSearch(e.target.value)} className={input + ' !mt-0'} />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {list.map((f) => (
                  <label key={f.id}
                    className={`flex items-center gap-3 text-sm border rounded-xl px-3 py-2.5 cursor-pointer transition ${
                      picked.includes(f.id) ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input type="checkbox" checked={picked.includes(f.id)} onChange={() => toggle(f.id)} />
                    <span className="font-semibold">{wings[f.wing_id]}-{f.flat_no}</span>
                    <span className="text-slate-500 truncate">{f.holder_name || ''}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="lg:hidden">{actions}</div>
    </form>
  )
}