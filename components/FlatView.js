'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'

const BADGE = {
  Sold: 'badge-green', Tenant: 'badge-blue', Owner: 'badge-purple', 'For Sale': 'badge-amber',
}
const SLOTS = [
  { kind: 'site_plan', label: 'Site plan' },
  { kind: 'agreement', label: 'Agreement' },
]
const input = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white mt-1'
const today = () => new Date().toISOString().slice(0, 10)

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  )
}

export default function FlatView({ flatId }) {
  const [d, setD] = useState(null)
  const [tick, setTick] = useState(0)
  const [adding, setAdding] = useState(false)
  const [pay, setPay] = useState({ amount: '', paid_on: today(), note: '' })
  const [saving, setSaving] = useState(false)
  const [tax, setTax] = useState(false)

  useEffect(() => {
    let off = false
    async function load() {
      const { data: f } = await supabase.from('flat_summary').select('*').eq('id', flatId).single()
      if (!f) return !off && setD({ missing: true })
      const { data: w } = await supabase.from('wings')
        .select('name, project_id, current_stage_id').eq('id', f.wing_id).single()
      const [{ data: c }, { data: docs }, { data: st }, { data: pays }, { data: fi }] = await Promise.all([
        supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
        supabase.from('documents').select('*').eq('flat_id', flatId).order('uploaded_at', { ascending: false }),
supabase.from('stages').select('id, position, name').eq('project_id', w.project_id).order('position'),
        supabase.from('payments').select('*').eq('flat_id', flatId).order('paid_on', { ascending: false }),
        supabase.from('flat_installments').select('stage_id, percent').eq('flat_id', flatId),
      ])
      let urls = {}
      if (docs?.length) {
        const { data: s } = await supabase.storage.from('documents')
          .createSignedUrls(docs.map((x) => x.storage_path), 3600)
        urls = Object.fromEntries((s || []).map((x) => [x.path, x.signedUrl]))
      }
      if (!off) setD({ f, charges: c || [], wing: w?.name, curStage: w?.current_stage_id,
        stages: st || [], inst: fi || [], pays: pays || [], docs: docs || [], urls })
    }
    load()
    return () => { off = true }
  }, [flatId, tick])

  async function addPayment(e) {
    e.preventDefault()
    setSaving(true); setErr('')
    const { error } = await supabase.from('payments').insert({
      flat_id: flatId, amount: Number(pay.amount), paid_on: pay.paid_on, note: pay.note || null,
    })
    setSaving(false)
    if (error) return setErr(error.message)
    setPay({ amount: '', paid_on: today(), note: '' })
    setAdding(false)
    setTick((t) => t + 1)
  }

  async function delPayment(id) {
    if (!confirm('Delete this payment?')) return
    await supabase.from('payments').delete().eq('id', id)
    setTick((t) => t + 1)
  }

  if (!d) return <p className="text-slate-500">Loading…</p>
  if (d.missing) return <p className="text-slate-500">Flat not found.</p>

  const { f, charges, wing, curStage, stages, inst, pays, docs, urls } = d
  const rows = stages
    .filter((s) => inst.some((i) => i.stage_id === s.id))
    .map((s) => ({ ...s, percent: Number(inst.find((i) => i.stage_id === s.id).percent) }))
  const agreement = Number(f.agreement_value || 0)
  const received = Number(f.received_amount || 0)
  const due = Number((tax ? f.due_with_charges : f.due_now) || 0)
  const pct = agreement ? Math.min(100, (received / agreement) * 100) : 0
  const curPos = stages.find((s) => s.id === curStage)?.position || 0
  const first = (f.holder_name || '').split(/&|,/)[0].trim()
  const msg = `Hello ${first}, as per the agreement the ${f.stage_name} stage is complete. Amount due: ${inr(due)}. Kindly arrange the payment. Thank you.`
  const wa = f.phone && due > 0 ? `https://wa.me/91${f.phone}?text=${encodeURIComponent(msg)}` : null

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/flats" className="text-sm text-slate-500 hover:text-slate-800">‹ All flats</Link>

      <section className="card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{wing}-{f.flat_no}</h1>
              <span className={`badge ${BADGE[f.status] || 'badge-gray'}`}>{f.status || 'No status'}</span>
            </div>
            <p className="text-slate-600 mt-1">{f.holder_name || 'No holder added'}</p>
            {f.phone && <p className="text-sm text-slate-500">+91 {f.phone}</p>}
          </div>
          <Link href={`/admin/flats/${f.id}/edit`} className="btn-primary">Edit flat</Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {f.is_sale && (
          <section className="card p-5 sm:p-6">
            <p className="text-sm text-slate-500">
              {f.stage_name ? `Due now (up to ${f.stage_name})` : 'No stage set for this wing yet'}
            </p>
            <div className="flex gap-2 mt-2">
              {[['Basic', false], ['With charges', true]].map(([l, v]) => (
                <button key={l} type="button" onClick={() => setTax(v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${tax === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300'}`}>{l}</button>
              ))}
            </div>
            <p className={`text-3xl font-bold mt-2 ${due > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {inr(due)}
            </p>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-primary mt-3 inline-block">Send WhatsApp reminder</a>}
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {inr(received)} received of {inr(agreement)} agreement value ({pct.toFixed(0)}%)
            </p>
          </section>
        )}

        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold mb-4">Flat details</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Floor" value={f.floor} />
            <Info label="Carpet area" value={f.carpet_sqft ? `${f.carpet_sqft} sq.ft${f.carpet_sqm ? ` (${f.carpet_sqm} sq.m)` : ''}` : f.carpet_sqm ? `${f.carpet_sqm} sq.m` : ''} />
            <Info label="Agreement no." value={f.agreement_no} />
            <Info label="Agreement date" value={f.agreement_date && new Date(f.agreement_date).toLocaleDateString('en-IN')} />
          </dl>
        </section>

        {f.is_sale && (
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Payments</h2>
              {!adding && <button className="btn" onClick={() => setAdding(true)}>Add payment</button>}
            </div>

            {adding && (
              <form onSubmit={addPayment} className="space-y-3 mb-4 border border-slate-200 rounded-xl p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">Amount (₹)
                    <input type="number" inputMode="decimal" required min="1" value={pay.amount}
                      onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={input} />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Date
                    <input type="date" required value={pay.paid_on}
                      onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} className={input} />
                  </label>
                </div>
                <label className="text-sm font-medium text-slate-700 block">Note (optional)
                  <input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })}
                    placeholder="e.g. cheque no., cash" className={input} />
                </label>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex gap-3">
                  <button disabled={saving || !pay.amount} className="btn-primary">{saving ? 'Saving…' : 'Save payment'}</button>
                  <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              </form>
            )}

            {pays.length === 0 ? (
              <p className="text-sm text-slate-500">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pays.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{inr(p.amount)}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {new Date(p.paid_on).toLocaleDateString('en-IN')}{p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <button className="text-xs text-red-600 shrink-0" onClick={() => delPayment(p.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {f.is_sale && rows.length > 0 && (
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold mb-3">Stages</h2>
            <ol className="space-y-2.5">
              {rows.map((s) =>  {
                const reached = s.position <= curPos
                return (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className={`h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white ${reached ? 'bg-green-600' : 'bg-slate-200'}`}>
                      {reached ? '✓' : ''}
                    </span>
                    <span className={`flex-1 ${reached ? '' : 'text-slate-400'}`}>{s.name}</span>
                    <span className="text-slate-500">{Number(s.percent)}%</span>
                    <span className={`w-24 text-right ${reached ? 'font-medium' : 'text-slate-400'}`}>
                      {inr(agreement * Number(s.percent) / 100)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {charges.length > 0 && (
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold mb-2">Charges</h2>
            <table className="w-full text-sm">
              <tbody>
                {charges.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-600">{c.name}</td>
                    <td className="py-2.5 text-right">{inr(c.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2.5">Total</td>
                  <td className="py-2.5 text-right">{inr(f.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold mb-4">Documents</h2>
          <div className="space-y-3">
            {SLOTS.map((s) => {
              const doc = docs.find((x) => x.kind === s.kind)
              return (
                <div key={s.kind} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500 truncate">{doc ? doc.file_name : 'Not uploaded'}</p>
                  </div>
                  {doc && <a href={urls[doc.storage_path]} target="_blank" rel="noreferrer" className="btn shrink-0">View</a>}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}