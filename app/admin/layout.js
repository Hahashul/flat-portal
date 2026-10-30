'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/admin', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/admin/flats', label: 'Flats', icon: 'M4 21V5l8-3 8 3v16M9 9h2m4 0h-2M9 13h2m4 0h-2M9 17h6' },
  { href: '/admin/flats/new', label: 'Add flat', icon: 'M12 5v14M5 12h14' },
  { href: '/admin/customers/new', label: 'Add customer', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6' },
  { href: '/admin/stages', label: 'Stages', icon: 'M4 6h16M4 12h16M4 18h16' },
]

function Icon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  )
}

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role !== 'admin') return router.replace('/')
      setEmail(session.user.email)
      setReady(true)
    }
    check()
  }, [router])

  useEffect(() => { setOpen(false) }, [pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) return <p className="p-8 text-slate-500">Loading…</p>

  const nav = (
    <>
      <nav className="space-y-1 flex-1">
        {links.map((l) => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon d={l.icon} />
              {l.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t pt-3">
        <p className="text-xs text-slate-500 truncate mb-2">{email}</p>
        <button onClick={logout} className="btn w-full">Sign out</button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-slate-200 p-4 flex-col sticky top-0 h-screen">
        <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">F</span>
          Flat Portal
        </h2>
        {nav}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between px-4 h-14">
        <span className="font-bold flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-xs">F</span>
          Flat Portal
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white p-4 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Flat Portal</h2>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2 -mr-2 text-slate-500">✕</button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  )
}