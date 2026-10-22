'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'

export default function Flats() {
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const q = search.toLowerCase()
  const shown = flats
    .filter((f) => `${f.flat_no} ${f.holder_name || ''}`.toLowerCase().includes(q))
    .sort((a, b) =>
      (wings[a.wing_id] || '').localeCompare(wings[b.wing_id] || '') ||
      a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true })
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Flats</h1>
        <Link href="/admin/flats/new" className="bg-black text-white rounded-lg px-4 py-2 text-sm">
          + Add flat
        </Link>
      </div>

      <input
        placeholder="Search by flat number or name"
        value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border rounded-lg px-3 py-2 mb-4 bg-white text-gray-900"
      />

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-gray-500">No flats yet. Click “Add flat” to create the first one.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="p-3">Wing</th><th className="p-3">Flat</th>
                <th className="p-3">Floor</th><th className="p-3">Holder</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Received</th>
                <th className="p-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="p-3">{wings[f.wing_id]}</td>
                  <td className="p-3 font-medium">
                    <Link href={`/admin/flats/${f.id}`} className="underline">{f.flat_no}</Link>
                  </td>
                  <td className="p-3">{f.floor}</td>
                  <td className="p-3">{f.holder_name}</td>
                  <td className="p-3">{f.status}</td>
                  <td className="p-3 text-right">{inr(f.total_amount)}</td>
                  <td className="p-3 text-right">{inr(f.received_amount)}</td>
                  <td className="p-3 text-right font-medium">{inr(f.balance_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}