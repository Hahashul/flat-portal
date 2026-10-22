'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FlatView from '@/components/FlatView'

export default function Portal() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState({})
  const [active, setActive] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      setEmail(session.user.email)
      const [{ data: f }, { data: w }] = await Promise.all([
        supabase.from('flat_summary').select('id, flat_no, wing_id').eq('customer_id', session.user.id),
        supabase.from('wings').select('id, name'),
      ])
      const list = (f || []).sort((a, b) => a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true }))
      setWings(Object.fromEntries((w || []).map((x) => [x.id, x.name])))
      setFlats(list)
      setActive(list[0]?.id || null)
      setLoading(false)
    }
    load()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <p className="p-8 text-slate-500">Loading…</p>

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between">
        <span className="font-bold flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-xs">F</span>
          <span className="truncate">860 Shukrawar Peth</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-slate-500">{email}</span>
          <button onClick={logout} className="btn !py-1.5">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {flats.length === 0 ? (
          <p className="text-slate-500">No flats are linked to your account yet. Please contact the office.</p>
        ) : (
          <>
            {flats.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {flats.map((f) => (
                  <button key={f.id} onClick={() => setActive(f.id)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold border transition ${
                      active === f.id
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}>
                    {wings[f.wing_id]}-{f.flat_no}
                  </button>
                ))}
              </div>
            )}
            <FlatView flatId={active} />
          </>
        )}
      </main>
    </div>
  )
}