'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { inr, inrShort } from '@/lib/format'

const sum = (arr, key) => arr.reduce((s, x) => s + Number(x[key] || 0), 0)

const STATUS_BADGE = {
  Sold: 'badge-green', Tenant: 'badge-blue', Owner: 'badge-purple',
  'For Sale': 'badge-amber', 'No status': 'badge-gray',
}

const ICONS = {
  flats: 'M4 21V5l8-3 8 3v16M9 9h2m4 0h-2M9 13h2m4 0h-2M9 17h6',
  total: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  received: 'M20 6L9 17l-5-5',
  pending: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
}

function Stat({ label, value, sub, icon, tone }) {
  return (
    <div className="card card-hover p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`w-9 h-9 rounded-xl grid place-items-center ${tone}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
        </span>
      </div>
      <p className="text-2xl font-bold mt-2 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function Bar({ pct, color = 'bg-brand-600' }) {
  return (
    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export default function Dashboard() {
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: f }, { data: w }] = await Promise.all([
        supabase.from('flat_summary').select('*'),
        supabase.from('wings').select('id, name').order('name'),
      ])
      setFlats(f || [])
      setWings(w || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-slate-500">Loading…</p>

  const total = sum(flats, 'total_amount')
  const received = sum(flats, 'received_amount')
  const pending = sum(flats, 'balance_amount')
  const pct = total ? (received / total) * 100 : 0

  const byStatus = {}
  flats.forEach((f) => {
    const s = f.status || 'No status'
    byStatus[s] = (byStatus[s] || 0) + 1
  })
  const statusRows = Object.entries(byStatus).sort((a, b) => b[1] - a[1])

  const wingRows = wings.map((w) => {
    const list = flats.filter((f) => f.wing_id === w.id)
    const t = sum(list, 'total_amount')
    const r = sum(list, 'received_amount')
    return { id: w.id, name: w.name, count: list.length, total: t, received: r, balance: t - r, pct: t ? (r / t) * 100 : 0 }
  })

  const nameOf = (f) => `${wings.find((w) => w.id === f.wing_id)?.name || '?'}-${f.flat_no}`
  const topDue = flats
    .filter((f) => Number(f.balance_amount) > 0)
    .sort((a, b) => Number(b.balance_amount) - Number(a.balance_amount))
    .slice(0, 5)

  const withLogin = flats.filter((f) => f.customer_id).length

  if (flats.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-slate-500">No flats yet.{' '}
          <Link href="/admin/flats/new" className="text-brand-600 font-medium underline">Add the first one</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Total flats" value={flats.length} sub={`${withLogin} with a customer login`}
          icon="flats" tone="bg-brand-100 text-brand-700" />
        <Stat label="Total sales value" value={inrShort(total)} sub={inr(total)}
          icon="total" tone="bg-slate-100 text-slate-700" />
        <Stat label="Received" value={inrShort(received)} sub={inr(received)}
          icon="received" tone="bg-green-100 text-green-700" />
        <Stat label="Pending" value={inrShort(pending)} sub={inr(pending)}
          icon="pending" tone="bg-amber-100 text-amber-700" />
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Collection progress</h2>
          <span className="text-sm font-semibold text-brand-700">{pct.toFixed(1)}% collected</span>
        </div>
        <Bar pct={pct} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-5 sm:p-6 min-w-0">
          <h2 className="font-semibold mb-4">Flats by status</h2>
          <div className="space-y-4">
            {statusRows.map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`badge ${STATUS_BADGE[name] || 'badge-gray'}`}>{name}</span>
                  <span className="text-sm font-semibold text-slate-600">{count}</span>
                </div>
                <Bar pct={(count / flats.length) * 100} />
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5 sm:p-6 min-w-0">
          <h2 className="font-semibold mb-3">Highest balances due</h2>
          {topDue.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <ul className="-mx-2">
              {topDue.map((f) => (
                <li key={f.id}>
                  <Link href={`/admin/flats/${f.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-brand-50 transition">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{nameOf(f)}</p>
                      <p className="text-sm text-slate-500 truncate">{f.holder_name || '—'}</p>
                    </div>
                    <span className="font-semibold text-sm text-amber-700 whitespace-nowrap">
                      {inr(f.balance_amount)}
                    </span>
                    <span className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold mb-4">By wing</h2>

        {/* Phone: cards */}
        <div className="md:hidden space-y-3">
          {wingRows.map((w) => (
            <div key={w.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="font-semibold">Wing {w.name}</span>
                <span className="text-sm text-slate-500">{w.count} flats</span>
              </div>
              <Bar pct={w.pct} />
              <dl className="grid grid-cols-3 gap-2 text-xs mt-3">
                <div><dt className="text-slate-500">Total</dt><dd className="font-semibold">{inrShort(w.total)}</dd></div>
                <div><dt className="text-slate-500">Received</dt><dd className="font-semibold text-green-700">{inrShort(w.received)}</dd></div>
                <div><dt className="text-slate-500">Balance</dt><dd className="font-semibold text-amber-700">{inrShort(w.balance)}</dd></div>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2">Wing</th>
                <th className="py-2 text-right">Flats</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Received</th>
                <th className="py-2 text-right">Balance</th>
                <th className="py-2 pl-6 w-40">Collected</th>
              </tr>
            </thead>
            <tbody>
              {wingRows.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="py-3 font-semibold">{w.name}</td>
                  <td className="py-3 text-right">{w.count}</td>
                  <td className="py-3 text-right">{inr(w.total)}</td>
                  <td className="py-3 text-right text-green-700">{inr(w.received)}</td>
                  <td className="py-3 text-right text-amber-700">{inr(w.balance)}</td>
                  <td className="py-3 pl-6"><Bar pct={w.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}