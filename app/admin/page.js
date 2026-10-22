'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { inr, inrShort } from '@/lib/format'

const sum = (arr, key) => arr.reduce((s, x) => s + Number(x[key] || 0), 0)

function Card({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function Bar({ pct }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
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

  if (loading) return <p className="text-gray-500">Loading…</p>

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
        <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
        <p className="text-gray-500">No flats yet. <Link href="/admin/flats/new" className="underline">Add the first one</Link> and the numbers will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Total flats" value={flats.length} sub={`${withLogin} with a customer login`} />
        <Card label="Total sales value" value={inrShort(total)} sub={inr(total)} />
        <Card label="Received" value={inrShort(received)} sub={inr(received)} />
        <Card label="Pending" value={inrShort(pending)} sub={inr(pending)} />
      </div>

      <section className="bg-white rounded-xl shadow p-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-medium">Collection progress</h2>
          <span className="text-sm text-gray-500">{pct.toFixed(1)}% collected</span>
        </div>
        <Bar pct={pct} />
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="font-medium mb-4">Flats by status</h2>
          <div className="space-y-3">
            {statusRows.map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{name}</span><span className="text-gray-500">{count}</span>
                </div>
                <Bar pct={(count / flats.length) * 100} />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="font-medium mb-4">Highest balances due</h2>
          {topDue.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing pending.</p>
          ) : (
            <ul className="divide-y text-sm">
              {topDue.map((f) => (
                <li key={f.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <Link href={`/admin/flats/${f.id}`} className="underline font-medium whitespace-nowrap">
                        {nameOf(f)}
                        </Link>
                        <p className="text-gray-500 truncate">{f.holder_name}</p>
                    </div>
                    <span className="font-medium whitespace-nowrap">{inr(f.balance_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="font-medium mb-4">By wing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
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
                  <td className="py-2 font-medium">{w.name}</td>
                  <td className="py-2 text-right">{w.count}</td>
                  <td className="py-2 text-right">{inr(w.total)}</td>
                  <td className="py-2 text-right">{inr(w.received)}</td>
                  <td className="py-2 text-right">{inr(w.balance)}</td>
                  <td className="py-2 pl-6"><Bar pct={w.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}