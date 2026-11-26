'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import Shell from '@/components/Shell'

const links = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Customers', icon: Users, active: (p) => p.startsWith('/admin/customers') },
]

const crumbs = (pathname) =>
  pathname.startsWith('/admin/customers') ? [{ label: 'Customers' }] : [{ label: 'Home' }]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      const { data: profile } = await supabase
        .from('profiles').select('role, disabled').eq('id', session.user.id).single()
      if (profile?.disabled) {
        await supabase.auth.signOut()
        return router.replace('/login')
      }
      if (profile?.role !== 'admin') return router.replace('/app')
      setEmail(session.user.email)
      setReady(true)
    }
    check()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-3xl" />
      </div>
    )
  }

  return (
    <Shell links={links} crumbs={crumbs} brand="Admin" email={email} onLogout={logout}>
      {children}
    </Shell>
  )
}
