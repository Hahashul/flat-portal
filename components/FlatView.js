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

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  )
}

export default function FlatView({ flatId, admin = false }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    let off = false
    async function load() {
      setD(null)
      const { data: f } = await supabase.from('flat_summary').select('*').eq('id', flatId).single()
      if (!f) return !off && setD({ missing: true })
      const [{ data: c }, { data: w }, { data: docs }, { data: prof }] = await Promise.all([
        supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
        supabase.from('wings').select('name').eq('id', f.wing_id).single(),
        supabase.from('documents').select('*').eq('flat_id', flatId).order('uploaded_at', { ascending: false }),
        admin && f.customer_id
          ? supabase.from('profiles').select('full_name, phone').eq('id', f.customer_id).single()
          : Promise.resolve({ data: null }),
      ])
      let urls = {}
      if (docs?.length) {
        const { data: s } = await supabase.storage.from('documents')
          .createSignedUrls(docs.map((x) => x.storage_path), 3600)
        urls = Object.fromEntries((s || []).map((x) => [x.path, x.signedUrl]))
      }
      if (!off) setD({ f, charges: c || [], wing: w?.name, docs: docs || [], urls, prof })
    }
    load()
    return () => { off = true }
  }, [flatId, admin])

  if (!d) return <p className="text-slate-500">Loading…</p>
  if (d.missing) return <p className="text-slate-500">Flat not found.</p>

  const { f, charges, wing, docs, urls, prof } = d
  const showMoney = charges.length > 0 || Number(f.received_amount) > 0
  const total = Number(f.total_amount || 0)
  const received = Number(f.received_amount || 0)
  const balance = Number(f.balance_amount || 0)
  const pct = total ? Math.min(100, (received / total) * 100) : 0

  return (
    <div className="space-y-6 max-w-5xl">
      {admin && (
        <Link href="/admin/flats" className="text-sm text-slate-500 hover:text-slate-800">‹ All flats</Link>
      )}

      <section className="card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{wing}-{f.flat_no}</h1>
              <span className={`badge ${BADGE[f.status] || 'badge-gray'}`}>{f.status || 'No status'}</span>
            </div>
            <p className="text-slate-600 mt-1">{f.holder_name || 'No holder added'}</p>
          </div>
          {admin && <Link href={`/admin/flats/${f.id}/edit`} className="btn-primary">Edit flat</Link>}
        </div>
        {admin && (
          <p className="text-sm mt-3 text-slate-500">
            Customer login:{' '}
            {f.customer_id
              ? <span className="font-medium text-green-700">Linked{prof?.full_name ? ` · ${prof.full_name}` : ''}{prof?.phone ? ` · ${prof.phone}` : ''}</span>
              : <span className="font-medium text-amber-700">Not created yet</span>}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {showMoney && (
          <section className="card p-5 sm:p-6">
            <p className="text-sm text-slate-500">{balance > 0 ? 'Balance due' : 'Fully paid'}</p>
            <p className={`text-3xl font-bold mt-1 ${balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {inr(balance)}
            </p>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {inr(received)} received of {inr(total)} ({pct.toFixed(0)}%)
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

        {showMoney && (
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold mb-2">Payment details</h2>
            <table className="w-full text-sm">
              <tbody>
                {charges.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-600">{c.name}</td>
                    <td className="py-2.5 text-right">{inr(c.amount)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100 font-semibold">
                  <td className="py-2.5">Total</td><td className="py-2.5 text-right">{inr(total)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 text-slate-600">Received</td>
                  <td className="py-2.5 text-right text-green-700">{inr(received)}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-2.5">Balance</td>
                  <td className="py-2.5 text-right text-amber-700">{inr(balance)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-2">
              Last updated {new Date(f.updated_at).toLocaleDateString('en-IN')}
            </p>
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
                  {doc && (
                    <a href={urls[doc.storage_path]} target="_blank" rel="noreferrer" className="btn shrink-0">View</a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}