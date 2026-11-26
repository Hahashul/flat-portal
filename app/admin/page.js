'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function Stat({ label, value }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-medium tabular-nums">{value}</p></CardContent>
    </Card>
  )
}

export default function AdminHome() {
  const [customers, setCustomers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/customers', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return setError(body.error || 'Could not load customers')
      setCustomers(body.customers || [])
    }
    load()
  }, [])

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!customers) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>

  const real = customers.filter((c) => !c.is_demo)
  const users = real.flatMap((c) => c.users)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Platform</h1>
        <Button asChild><Link href="/admin/customers">Manage customers</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={real.length} />
        <Stat label="Active logins" value={users.filter((u) => !u.disabled).length} />
        <Stat label="Disabled logins" value={users.filter((u) => u.disabled).length} />
        <Stat label="Flats tracked" value={real.reduce((n, c) => n + c.flats, 0)} />
      </div>
    </div>
  )
}
