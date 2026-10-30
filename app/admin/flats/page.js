'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'

const STATUS_BADGE = {
  Sold: 'badge-green', Tenant: 'badge-blue', Owner: 'badge-purple',
  'For Sale': 'badge-amber', 'No status': 'badge-gray',
}
const CHIPS = ['All', 'Sold', 'Tenant', 'Owner', 'For Sale', 'No status']

function waLink(f) {
  const first = (f.holder_name || '').split(/&|,/)[0].trim()
  const msg = `Hello ${first}, as per the agreement the ${f.stage_name} stage is complete. Amount due: ${inr(f.due_now)}. Kindly arrange the payment. Thank you.`
  return f.phone ? `https://wa.me/91${f.phone}?text=${encodeURIComponent(msg)}` : null
}

function Status({ value }) {
  const s = value || 'No status'
  return <span className={`badge ${STATUS_BADGE[s] || 'badge-gray'}`}>{s}</span>
}

function Paid({ f }) {
  const agr = Number(f.agreement_value || 0)
  if (!f.is_sale || !agr) return <span className="text-xs text-slate-400">—</span>
  const pct = Math.min(100, (Number(f.received_amount) / agr) * 100)
  return (
    <div className="w-full">
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-1">{pct.toFixed(0)}% paid</p>
    </div>
  )
}

function Due({ f }) {
  if (!f.is_sale) return <span className="text-xs text-slate-400">—</span>
  const d = Number(f.due_now)
  return <span className={`font-semibold ${d > 0 ? 'text-amber-700' : 'text-green-700'}`}>{d > 0 ? inr(d) : 'Up to date'}</span>
}

function Wa({ f }) {
  const wa = Number(f.due_now) > 0 && f.is_sale ? waLink(f) : null
  if (!wa) return null
  return (
    <a href={wa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className="btn !py-1.5">WhatsApp</a>
  )
}

export default function Flats() {
  const router = useRouter()
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('All')

  useEffect(() => {
    async function load() {
      const [{ data: f }, { data: w }] = await Promise.all([
        supabase.from('flat_summary').select('*'),
        supabase.from('wings').select('id, name'),
      ])
      setWings(Object.fromEntries((w || []).map((x) => [x.id, x.name])))
      setFlats(f || [])
      setLoading(false)
    }
    load()
  }, [])

  const statusOf = (f) => f.status || 'No status'
  const count = (c) => (c === 'All' ? flats.length : flats.filter((f) => statusOf(f) === c).length)
  const q = search.toLowerCase()
  const shown = flats
    .filter((f) => chip === 'All' || statusOf(f) === chip)
    .filter((f) => `${wings[f.wing_id] || ''}-${f.flat_no} ${f.holder_name || ''}`.toLowerCase().includes(q))
    .sort((a, b) =>
      (wings[a.wing_id] || '').localeCompare(wings[b.wing_id] || '') ||
      a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true })
    )
  const open = (id) => router.push(`/admin/flats/${id}`)

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Flats</h1>
        <Link href="/admin/flats/new" className="btn-primary">+ Add flat</Link>
      </div>

      <input placeholder="Search by flat number or name" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:max-w-sm border border-slate-300 rounded-xl px-4 py-2.5 bg-white" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHIPS.filter((c) => c === 'All' || count(c) > 0).map((c) => (
          <button key={c} onClick={() => setChip(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium border transition ${
              chip === c ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {c} <span className="opacity-70">{count(c)}</span>
          </button>
        ))}
      </div>

      {loading ? <p className="text-slate-500">Loading…</p>
        : shown.length === 0 ? <p className="text-slate-500">No flats match.</p> : (
        <>
          <div className="md:hidden space-y-3">
            {shown.map((f) => (
              <div key={f.id} onClick={() => open(f.id)} className="card card-hover p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{wings[f.wing_id]}-{f.flat_no}
                      <span className="font-normal text-slate-500 text-sm"> · {f.floor || '—'}</span></p>
                    <p className="text-sm text-slate-600 truncate">{f.holder_name || 'No holder'}</p>
                  </div>
                  <Status value={f.status} />
                </div>
                {f.is_sale && (
                  <div className="grid grid-cols-2 gap-4 mt-3 items-end">
                    <Paid f={f} />
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Due now</p>
                      <Due f={f} />
                    </div>
                  </div>
                )}
                <div className="flex justify-end mt-3"><Wa f={f} /></div>
              </div>
            ))}
          </div>

          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3">Flat</th><th className="p-3">Holder</th><th className="p-3">Status</th>
                  <th className="p-3 w-32">Paid</th><th className="p-3 text-right">Due now</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id} onClick={() => open(f.id)}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-brand-50 transition">
                    <td className="p-3">
                      <p className="font-bold">{wings[f.wing_id]}-{f.flat_no}</p>
                      <p className="text-xs text-slate-500">{f.floor || '—'}</p>
                    </td>
                    <td className="p-3 max-w-xs truncate">{f.holder_name || '—'}</td>
                    <td className="p-3"><Status value={f.status} /></td>
                    <td className="p-3"><Paid f={f} /></td>
                    <td className="p-3 text-right"><Due f={f} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className="inline-flex gap-2"><Wa f={f} />
                        <Link href={`/admin/flats/${f.id}/edit`} onClick={(e) => e.stopPropagation()}
                          className="btn !py-1.5">Edit</Link></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}