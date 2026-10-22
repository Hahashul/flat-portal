'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/flats', label: 'Flats' },
  { href: '/admin/flats/new', label: 'Add flat' },
  { href: '/admin/customers/new', label: 'Add customer' },
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')

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

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      <aside className="w-56 bg-white border-r p-4 flex flex-col">
        <h2 className="font-semibold text-lg mb-6">Flat Portal</h2>
        <nav className="space-y-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href} href={l.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                pathname === l.href ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-gray-500 truncate">{email}</p>
        <button onClick={logout} className="text-sm text-left underline mt-1">Sign out</button>
      </aside>
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  )
}