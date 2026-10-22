'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function go() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      router.replace(profile?.role === 'admin' ? '/admin' : '/portal')
    }
    go()
  }, [router])

  return <p className="p-8">Loading…</p>
}