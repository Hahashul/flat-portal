'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const input = 'w-full border rounded-lg px-3 py-2 bg-white text-gray-900'

export default function NewCustomer() {
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState({})
  const [form, setForm] = useState({ email: '', full_name: '', phone: '' })
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function load() {
    const [{ data: f }, { data: w }] = await Promise.all([
      supabase.from('flats').select('id, flat_no, wing_id, holder_name').is('customer_id', null),
      supabase.from('wings').select('id, name'),
    ])
    setWings(Object.fromEntries((w || []).map((x) => [x.id, x.name])))
    setFlats(f || [])
  }
  useEffect(() => { load() }, [])

  const toggle = (id) =>
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

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
    setPicked([])
    setForm({ email: '', full_name: '', phone: '' })
    load()
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Add customer login</h1>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
          {result.existing ? (
            <p>This person already had a login. The flats were added to it. Their password is unchanged.</p>
          ) : (
            <>
              <p className="font-medium">Login created. Share these details now — the password is not shown again.</p>
              <p className="mt-2">Email: <b>{result.email}</b></p>
              <p>Temporary password: <b>{result.password}</b></p>
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
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-3">
        <h2 className="font-medium">Flats for this customer</h2>
        {flats.length === 0 ? (
          <p className="text-sm text-gray-500">Every flat already has a login.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {flats
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