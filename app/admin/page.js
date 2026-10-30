'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { inr, inrShort } from '@/lib/format'

const sum = (arr, key) => arr.reduce((s, x) => s + Number(x[key] || 0), 0)

export function waLink(f, wing) {
  const first = (f.holder_name || '').split(/&|,/)[0].trim()
  const msg = `Hello ${first}, as per the agreement the ${f.stage_name} stage is complete. Amount due: ${inr(f.due_now)}. Kindly arrange the payment. Thank you.`
  return f.phone ? `https://wa.me/91${f.phone}?text=${encodeURIComponent(msg)}` : null
}

export default function Dashboard() {
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState([])
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tax, setTax] = useState(false)
  
  async function load() {
    const [{ data: f }, { data: w }, { data: s }] = await Promise.all([
      supabase.from('flat_summary').select('*'),
      supabase.from('wings').select('id, name, current_stage_id').order('name'),
      supabase.from('stages').select('id, name, position').order('position'),
    ])
    setFlats(f || []); setWings(w || []); setStages(s || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function setStage(wingId, stageId) {
    await supabase.from('wings').update({ current_stage_id: stageId || null }).eq('id', wingId)
    load()
  }

  if (loading) return <p className="text-slate-500">Loading…</p>

  const sold = flats
    .map((f) => ({ ...f, due_now: tax ? f.due_with_charges : f.due_now }))
    .filter((f) => f.is_sale)
  const agreement = sum(sold, 'agreement_value')
  const received = sum(sold, 'received_amount')
  const dueNow = sum(sold, 'due_now')
  const wname = (id) => wings.find((w) => w.id === id)?.name || '?'
  const collect = sold.filter((f) => Number(f.due_now) > 0)
    .sort((a, b) => Number(b.due_now) - Number(a.due_now))

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {[['Basic due', false], ['Due with charges', true]].map(([l, v]) => (
            <button key={l} onClick={() => setTax(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border ${tax === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          ['Collect now', inrShort(dueNow), 'text-amber-700'],
          ['Received', inrShort(received), 'text-green-700'],
          ['Sales value', inrShort(agreement), ''],
          ['Sold flats', sold.length, ''],
        ].map(([l, v, c]) => (
          <div key={l} className="card p-4 sm:p-5">
            <p className="text-sm text-slate-500">{l}</p>
            <p className={`text-2xl font-bold mt-2 ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold mb-1">Construction progress</h2>
        <p className="text-sm text-slate-500 mb-4">Change a wing's stage and every flat's due amount updates.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {wings.map((w) => (
            <label key={w.id} className="text-sm font-medium text-slate-700 block">
              Wing {w.name}
              <select value={w.current_stage_id || ''} onChange={(e) => setStage(w.id, e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white mt-1">
                <option value="">Not started</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold mb-3">Collect now</h2>
        {collect.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing due right now.</p>
        ) : (
          <ul className="-mx-2">
            {collect.map((f) => {
              const wa = waLink(f)
              return (
                <li key={f.id} className="flex items-center gap-3 px-2 py-3 border-b border-slate-100 last:border-0">
                  <Link href={`/admin/flats/${f.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{wname(f.wing_id)}-{f.flat_no}</p>
                    <p className="text-sm text-slate-500 truncate">{f.holder_name || '—'}</p>
                  </Link>
                  <span className="font-semibold text-sm text-amber-700 whitespace-nowrap">{inr(f.due_now)}</span>
                  {wa
                    ? <a href={wa} target="_blank" rel="noreferrer" className="btn !py-1.5 shrink-0">WhatsApp</a>
                    : <span className="text-xs text-slate-400 shrink-0 w-20 text-center">No phone</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}