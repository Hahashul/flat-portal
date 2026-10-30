'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// To add car parking later, add 'Car parking' to this list.
const CHARGE_NAMES = ['Agreement value', 'Stamp duty & registration', 'MSEB', 'Legal', 'GST']
const SLOTS = [
  { kind: 'site_plan', label: 'Site plan' },
  { kind: 'agreement', label: 'Agreement' },
]

const input = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white mt-1'
const grid = 'grid grid-cols-1 sm:grid-cols-2 gap-4'

const empty = {
  wing_id: '', flat_no: '', floor: '', carpet_sqm: '', carpet_sqft: '',
  status: '', holder_name: '', phone: '', agreement_no: '', agreement_date: '',
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`text-sm font-medium text-slate-700 block ${className}`}>
      {label}{required && <span className="text-red-500"> *</span>}
      {children}
    </label>
  )
}

function PendingSlot({ slot, file, onPick }) {
  const ref = useRef(null)
  const [stages, setStages] = useState([])
  const [templates, setTemplates] = useState([])
  const [inst, setInst] = useState({})

  function choose(f) {
    if (!f) return
    const ok = f.type === 'application/pdf' || f.type.startsWith('image/')
    if (!ok) return setError('Please choose a PDF or an image.')
    if (f.size > 20 * 1024 * 1024) return setError('File is too large (maximum 20 MB).')
    setError('')
    onPick(f)
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{slot.label}</p>
        {file ? (
          <span className="badge badge-green">Selected</span>
        ) : (
          <span className="badge badge-gray">Optional</span>
        )}
      </div>
      <input ref={ref} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => choose(e.target.files?.[0])} />
      <div className="flex items-center gap-3 mt-3">
        <button type="button" className="btn" onClick={() => ref.current?.click()}>
          {file ? 'Change file' : 'Choose file'}
        </button>
        {file && (
          <>
            <span className="text-sm text-slate-600 truncate">{file.name}</span>
            <button type="button" className="text-sm text-red-600 shrink-0"
              onClick={() => { onPick(null); if (ref.current) ref.current.value = '' }}>
              Remove
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

export default function FlatForm({ flatId, children }) {
  const router = useRouter()
  const [wings, setWings] = useState([])
  const [statuses, setStatuses] = useState([])
  const [form, setForm] = useState(empty)
  const [charges, setCharges] = useState({})
  const [files, setFiles] = useState({})
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stages, setStages] = useState([])
  const [templates, setTemplates] = useState([])
  const [inst, setInst] = useState({})

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: s }, { data: st }, { data: tp }] = await Promise.all([
        supabase.from('wings').select('id, name').order('name'),
        supabase.from('statuses').select('name, counts_in_sales').order('name'),
        supabase.from('stages').select('id, name, position').order('position'),
        supabase.from('installment_templates')
          .select('id, name, template_items(stage_id, percent)').order('name'),
      ])
      setWings(w || [])
      setStatuses(s || [])
      setStages(st || [])
      setTemplates(tp || [])

      if (flatId) {
        const [{ data: flat }, { data: ch }, { data: fi }] = await Promise.all([
          supabase.from('flats').select('*').eq('id', flatId).single(),
          supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
          supabase.from('flat_installments').select('stage_id, percent').eq('flat_id', flatId),
        ])
        setInst(Object.fromEntries((fi || []).map((x) => [x.stage_id, x.percent])))
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
  const isSale = !!statuses.find((s) => s.name === form.status)?.counts_in_sales
  const instTotal = Math.round(stages.reduce((t, s) => t + (Number(inst[s.id]) || 0), 0) * 100) / 100

  // Required fields. Holder is not needed for flats that are For Sale.
  const missing = []
  if (!form.wing_id) missing.push('wing')
  if (!form.flat_no.trim()) missing.push('flat number')
  if (!String(form.floor).trim()) missing.push('floor')
  if (!form.status) missing.push('status')
  if (form.status !== 'For Sale' && !String(form.holder_name).trim()) missing.push('holder name')

  async function save(e) {
    e.preventDefault()
    if (missing.length) return
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
      phone: form.phone.replace(/\D/g, '').slice(-10) || null,
      agreement_no: form.agreement_no || null,
      agreement_date: form.agreement_date || null,
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
    if (isSale) {
      const keepI = stages.filter((s) => Number(inst[s.id]) > 0)
      const dropI = stages.filter((s) => !(Number(inst[s.id]) > 0))
      if (keepI.length) {
        const { error: err } = await supabase.from('flat_installments').upsert(
          keepI.map((s) => ({ flat_id: id, stage_id: s.id, percent: Number(inst[s.id]) })),
          { onConflict: 'flat_id,stage_id' })
        if (err) return fail(err, 'Flat saved, but installments failed: ')
      }
      if (flatId && dropI.length) {
        const { error: err } = await supabase.from('flat_installments')
          .delete().eq('flat_id', id).in('stage_id', dropI.map((s) => s.id))
        if (err) return fail(err, 'Flat saved, but installments failed: ')
      }
    }

    // Upload files chosen on the Add page.
    let uploadFailed = false
    if (!flatId) {
      for (const slot of SLOTS) {
        const file = files[slot.kind]
        if (!file) continue
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `flats/${id}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
        if (upErr) { uploadFailed = true; continue }
        const { error: dbErr } = await supabase.from('documents').insert({
          flat_id: id, kind: slot.kind, file_name: file.name, storage_path: path,
        })
        if (dbErr) {
          await supabase.storage.from('documents').remove([path])
          uploadFailed = true
        }
      }
    }

    if (uploadFailed) {
      alert('The flat was saved, but a file did not upload. Please upload it again on this page.')
      return router.push(`/admin/flats/${id}/edit`)
    }
    router.push(flatId ? `/admin/flats/${flatId}` : '/admin/flats')
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

  if (loading) return <p className="text-slate-500">Loading…</p>

    const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={saving || missing.length > 0} className="btn-primary">
        {saving ? 'Saving…' : 'Save flat'}
      </button>
      <button type="button" className="btn"
        onClick={() => router.push(flatId ? `/admin/flats/${flatId}` : '/admin/flats')}>
        Cancel
      </button>
      {flatId && (
        <button type="button" onClick={remove}
          className="text-sm text-red-600 font-medium ml-auto">
          Delete flat
        </button>
      )}
      {missing.length > 0 && (
        <p className="text-sm text-amber-700 basis-full">
          Still needed: {missing.join(', ')}
        </p>
      )}
    </div>
  )

  return (
    <form onSubmit={save} className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">{flatId ? 'Edit flat' : 'Add flat'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="font-semibold">Flat details</h2>
            <div className={grid}>
              <Field label="Wing" required>
                <select value={form.wing_id} onChange={set('wing_id')} className={input}>
                  {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Flat number" required>
                <input value={form.flat_no} onChange={set('flat_no')} className={input} />
              </Field>
              <Field label="Floor" required>
                <input value={form.floor} onChange={set('floor')} placeholder="e.g. 2nd Floor" className={input} />
              </Field>
              <Field label="Status" required>
                <select value={form.status} onChange={set('status')} className={input}>
                  <option value="">Select status</option>
                  {statuses.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Carpet area (sq.m)">
                <input type="number" inputMode="decimal" step="0.01" value={form.carpet_sqm}
                  onChange={set('carpet_sqm')} className={input} />
              </Field>
              <Field label="Carpet area (sq.ft)">
                <input type="number" inputMode="decimal" step="0.01" value={form.carpet_sqft}
                  onChange={set('carpet_sqft')} className={input} />
              </Field>
            </div>
          </section>

          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="font-semibold">Holder and agreement</h2>
            <div className={grid}>
              <Field label="Name of flat holder(s)" required={form.status !== 'For Sale'} className="sm:col-span-2">
                <input value={form.holder_name} onChange={set('holder_name')}
                  placeholder="Joint holders: Name 1 & Name 2" className={input} />
              </Field>
               <Field label="Phone (for WhatsApp)">
                <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')}
                  placeholder="10-digit mobile number" className={input} />
              </Field>
              <Field label="Agreement number">
                <input value={form.agreement_no} onChange={set('agreement_no')} className={input} />
              </Field>
              <Field label="Agreement date">
                <input type="date" value={form.agreement_date} onChange={set('agreement_date')} className={input} />
              </Field>
            </div>
          </section>
          <div className="hidden lg:block">{actions}</div>  
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="font-semibold">Account (₹)</h2>
            <div className={grid}>
              {CHARGE_NAMES.map((n) => (
                <Field key={n} label={n}>
                  <input type="number" inputMode="decimal" step="0.01" value={charges[n] ?? ''}
                    onChange={(e) => setCharges({ ...charges, [n]: e.target.value })} className={input} />
                </Field>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Total and balance are calculated automatically.
              {updatedAt && ` Last updated ${new Date(updatedAt).toLocaleString('en-IN')}.`}
            </p>
          </section>
          {isSale && (
            <section className="card p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold">Installments (% of agreement value)</h2>
              <select defaultValue="" className={input}
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value)
                  if (t) setInst(Object.fromEntries(t.template_items.map((i) => [i.stage_id, i.percent])))
                  e.target.value = ''
                }}>
                <option value="">Fill from a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{s.name}</span>
                    <input type="number" inputMode="decimal" step="0.01" min="0"
                      value={inst[s.id] ?? ''}
                      onChange={(e) => setInst({ ...inst, [s.id]: e.target.value })}
                      className="w-24 border border-slate-300 rounded-xl px-3 py-2 bg-white text-right" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                ))}
              </div>
              <p className={`text-sm ${instTotal === 100 ? 'text-green-700' : 'text-amber-700'}`}>
                Total {instTotal}%{instTotal !== 100 && ' (should be 100%)'}
              </p>
            </section>
          )}
          {flatId ? children : (
            <section className="card p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-semibold">Documents</h2>
                <p className="text-xs text-slate-500">Optional. The files upload when you save the flat.</p>
              </div>
              {SLOTS.map((slot) => (
                <PendingSlot key={slot.kind} slot={slot} file={files[slot.kind]}
                  onPick={(f) => setFiles({ ...files, [slot.kind]: f })} />
              ))}
            </section>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Save buttons, at the end of the form */}
      <div className="lg:hidden">{actions}</div>
    </form>
  )
}