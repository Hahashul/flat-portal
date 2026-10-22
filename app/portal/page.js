'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'

export default function Portal() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [flats, setFlats] = useState([])
  const [charges, setCharges] = useState([])
  const [wings, setWings] = useState({})
  const [docs, setDocs] = useState([])
  const [urls, setUrls] = useState({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      setEmail(session.user.email)

      const { data: f } = await supabase
        .from('flat_summary').select('*').eq('customer_id', session.user.id)
      const ids = (f || []).map((x) => x.id)

      const [{ data: c }, { data: w }] = await Promise.all([
        ids.length
          ? supabase.from('flat_charges').select('flat_id, name, amount').in('flat_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('wings').select('id, name'),
      ])
      setFlats(f || [])
      setCharges(c || [])
      setWings(Object.fromEntries((w || []).map((x) => [x.id, x.name])))
      const { data: d } = ids.length
        ? await supabase.from('documents').select('*').in('flat_id', ids).order('uploaded_at', { ascending: false })
        : { data: [] }
      setDocs(d || [])
      if (d?.length) {
        const { data: signed } = await supabase.storage
          .from('documents').createSignedUrls(d.map((x) => x.storage_path), 3600)
        setUrls(Object.fromEntries((signed || []).map((s) => [s.path, s.signedUrl])))
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold">860 Shukrawar Peth</h1>
        <div className="text-sm text-right">
          <span className="text-gray-500 mr-3">{email}</span>
          <button onClick={logout} className="underline">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {flats.length === 0 && (
          <p className="text-gray-500">No flats are linked to your account yet. Please contact the office.</p>
        )}

        {flats.map((f) => {
          const mine = charges.filter((c) => c.flat_id === f.id)
          const showMoney = mine.length > 0 || Number(f.received_amount) > 0
          return (
            <section key={f.id} className="bg-white rounded-xl shadow p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Flat {f.flat_no} · Wing {wings[f.wing_id]}</h2>
                <p className="text-sm text-gray-500">{f.holder_name}</p>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-gray-500">Floor</dt><dd>{f.floor || '—'}</dd></div>
                <div><dt className="text-gray-500">Status</dt><dd>{f.status || '—'}</dd></div>
                <div><dt className="text-gray-500">Carpet area</dt>
                  <dd>{f.carpet_sqft ? `${f.carpet_sqft} sq.ft` : '—'}{f.carpet_sqm ? ` (${f.carpet_sqm} sq.m)` : ''}</dd>
                </div>
                <div><dt className="text-gray-500">Agreement</dt>
                  <dd>{f.agreement_no || '—'}{f.agreement_date ? ` · ${new Date(f.agreement_date).toLocaleDateString('en-IN')}` : ''}</dd>
                </div>
              </dl>

              {showMoney && (
                <div>
                  <h3 className="font-medium mb-2">Payment</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {mine.map((c) => (
                        <tr key={c.name} className="border-b">
                          <td className="py-2">{c.name}</td>
                          <td className="py-2 text-right">{inr(c.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-b font-medium">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right">{inr(f.total_amount)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Received</td>
                        <td className="py-2 text-right">{inr(f.received_amount)}</td>
                      </tr>
                      <tr className="font-semibold">
                        <td className="py-2">Balance</td>
                        <td className="py-2 text-right">{inr(f.balance_amount)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated {new Date(f.updated_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}
              {docs.filter((d) => d.flat_id === f.id).length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Documents</h3>
                  <ul className="space-y-1 text-sm">
                    {docs.filter((d) => d.flat_id === f.id).map((d) => (
                      <li key={d.id}>
                        <a href={urls[d.storage_path]} target="_blank" rel="noreferrer" className="underline">
                          {d.kind === 'site_plan' ? 'Site plan' : d.kind === 'agreement' ? 'Agreement' : 'Document'}
                          {' – '}{d.file_name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )
        })}
      </main>
    </div>
  )
}