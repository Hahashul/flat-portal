'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// To add car parking later, add 'Car parking' to this list.
const CHARGE_NAMES = [
  'Agreement value',
  'Stamp duty & registration',
  'MSEB',
  'Legal',
  'GST',
]

const input = 'w-full border rounded-lg px-3 py-2 bg-white text-gray-900'

const empty = {
  wing_id: '', flat_no: '', floor: '', carpet_sqm: '', carpet_sqft: '',
  status: '', holder_name: '', agreement_no: '', agreement_date: '',
  received_amount: '',
}

export default function FlatForm({ flatId, children }) {
  const router = useRouter()
  const [wings, setWings] = useState([])
  const [statuses, setStatuses] = useState([])
  const [form, setForm] = useState(empty)
  const [charges, setCharges] = useState({})
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: s }] = await Promise.all([
        supabase.from('wings').select('id, name').order('name'),
        supabase.from('statuses').select('name').order('name'),
      ])
      setWings(w || [])
      setStatuses(s || [])

      if (flatId) {
        const [{ data: flat }, { data: ch }] = await Promise.all([
          supabase.from('flats').select('*').eq('id', flatId).single(),
          supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
        ])
        if (flat) {
          const filled = {}
          Object.keys(empty).forEach((k) => { filled[k] = flat[k] ?? '' })
          setForm(filled)
          setUpdatedAt(flat.updated_at)
        }
        setCharges(Object.fromEntries((ch || []).map((c) => [c.name, c.amount])))
      } else if (w?.length) {
        setForm((f) => ({ ...f, wing_id: w[0].id }))
      }
      setLoading(false)
    }
    load()
  }, [flatId])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      wing_id: form.wing_id,
      flat_no: form.flat_no.trim(),
      floor: form.floor || null,
      carpet_sqm: form.carpet_sqm || null,
      carpet_sqft: form.carpet_sqft || null,
      status: form.status || null,
      holder_name: form.holder_name || null,
      agreement_no: form.agreement_no || null,
      agreement_date: form.agreement_date || null,
      received_amount: form.received_amount || 0,
    }

    let id = flatId
    if (flatId) {
      const { error: err } = await supabase.from('flats').update(payload).eq('id', flatId)
      if (err) return fail(err)
    } else {
      const { data, error: err } = await supabase.from('flats').insert(payload).select().single()
      if (err) return fail(err)
      id = data.id
    }

    const keep = CHARGE_NAMES.filter((n) => Number(charges[n]))
    const drop = CHARGE_NAMES.filter((n) => !Number(charges[n]))

    if (keep.length) {
      const rows = keep.map((n) => ({ flat_id: id, name: n, amount: Number(charges[n]) }))
      const { error: err } = await supabase
        .from('flat_charges').upsert(rows, { onConflict: 'flat_id,name' })
      if (err) return fail(err, 'Flat saved, but charges failed: ')
    }
    if (flatId && drop.length) {
      const { error: err } = await supabase
        .from('flat_charges').delete().eq('flat_id', id).in('name', drop)
      if (err) return fail(err, 'Flat saved, but charges failed: ')
    }

    router.push('/admin/flats')
  }

  function fail(err, prefix = '') {
    setError(err.code === '23505'
      ? 'That flat number already exists in this wing.'
      : prefix + err.message)
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Delete this flat and all its charges and documents? This cannot be undone.')) return
    const { data: docs } = await supabase.from('documents').select('storage_path').eq('flat_id', flatId)
    if (docs?.length) await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
    const { error: err } = await supabase.from('flats').delete().eq('id', flatId)
    if (err) return setError(err.message)
    router.push('/admin/flats')
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">{flatId ? 'Edit flat' : 'Add flat'}</h1>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-medium">Flat details</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Wing
            <select value={form.wing_id} onChange={set('wing_id')} required className={input}>
              {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Flat number
            <input value={form.flat_no} onChange={set('flat_no')} required className={input} />
          </label>
          <label className="text-sm">Floor
            <input value={form.floor} onChange={set('floor')} placeholder="e.g. 2nd Floor" className={input} />
          </label>
          <label className="text-sm">Status
            <select value={form.status} onChange={set('status')} className={input}>
              <option value="">—</option>
              {statuses.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Carpet area (sq.m)
            <input type="number" step="0.01" value={form.carpet_sqm} onChange={set('carpet_sqm')} className={input} />
          </label>
          <label className="text-sm">Carpet area (sq.ft)
            <input type="number" step="0.01" value={form.carpet_sqft} onChange={set('carpet_sqft')} className={input} />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-medium">Holder and agreement</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm col-span-2">Name of flat holder(s)
            <input value={form.holder_name} onChange={set('holder_name')} className={input} />
          </label>
          <label className="text-sm">Agreement number
            <input value={form.agreement_no} onChange={set('agreement_no')} className={input} />
          </label>
          <label className="text-sm">Agreement date
            <input type="date" value={form.agreement_date} onChange={set('agreement_date')} className={input} />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-medium">Account (₹)</h2>
        <div className="grid grid-cols-2 gap-4">
          {CHARGE_NAMES.map((n) => (
            <label key={n} className="text-sm">{n}
              <input
                type="number" step="0.01" value={charges[n] ?? ''}
                onChange={(e) => setCharges({ ...charges, [n]: e.target.value })}
                className={input}
              />
            </label>
          ))}
          <label className="text-sm">Received amount
            <input type="number" step="0.01" value={form.received_amount} onChange={set('received_amount')} className={input} />
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Total and balance are calculated automatically.
          {updatedAt && ` Last updated ${new Date(updatedAt).toLocaleString('en-IN')}.`}
        </p>
      </section>

      {children}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button disabled={saving} className="bg-black text-white rounded-lg px-6 py-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save flat'}
        </button>
        <button type="button" onClick={() => router.push('/admin/flats')} className="text-sm underline">
          Cancel
        </button>
        {flatId && (
          <button type="button" onClick={remove} className="text-sm text-red-600 underline ml-auto">
            Delete flat
          </button>
        )}
      </div>
    </form>
  )
}