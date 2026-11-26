'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Download, Trash2, UserPlus, KeyRound, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Section from '@/components/Section'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alike characters

function genPassword() {
  const a = new Uint32Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => ALPHABET[n % ALPHABET.length]).join('')
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Your session expired. Sign in again.')
  return { Authorization: `Bearer ${session.access_token}` }
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

async function downloadExport(org) {
  const res = await fetch(`/api/admin/customers?export=${org.id}`, { headers: await authHeader() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed')
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = `${org.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}

const when = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function PasswordField({ value, onChange }) {
  return (
    <Field label="Password">
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="off" />
        <Button type="button" variant="outline" onClick={() => onChange(genPassword())}>
          <RefreshCw className="size-4" /> Generate
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">At least 8 characters. You send this to the customer yourself.</p>
    </Field>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState(null)
  const [dialog, setDialog] = useState(null) // { type, org?, user? }
  const [form, setForm] = useState({ orgName: '', email: '', password: '', confirm: '' })
  const [done, setDone] = useState(null) // { title, email, password }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setCustomers((await api('GET', '/api/admin/customers')).customers)
    } catch (e) {
      toast.error(e.message)
      setCustomers([])
    }
  }, [])
  useEffect(() => { load() }, [load])

  function open(type, org, user) {
    setDone(null)
    setForm({ orgName: '', email: '', password: type === 'create' || type === 'addUser' || type === 'reset' ? genPassword() : '', confirm: '' })
    setDialog({ type, org, user })
  }
  const close = () => { if (!busy) { setDialog(null); setDone(null) } }
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    const { type, org, user } = dialog
    setBusy(true)
    try {
      if (type === 'create') {
        await api('POST', '/api/admin/customers', { orgName: form.orgName, email: form.email, password: form.password })
        setDone({ title: 'Customer created', email: form.email.trim().toLowerCase(), password: form.password })
      } else if (type === 'addUser') {
        await api('POST', '/api/admin/users', { orgId: org.id, email: form.email, password: form.password })
        setDone({ title: 'Login added', email: form.email.trim().toLowerCase(), password: form.password })
      } else if (type === 'reset') {
        await api('PATCH', '/api/admin/users', { userId: user.id, action: 'reset_password', password: form.password })
        setDone({ title: 'Password changed', email: user.email, password: form.password })
      } else if (type === 'removeUser') {
        await api('DELETE', '/api/admin/users', { userId: user.id })
        toast.success('Login removed')
        setDialog(null)
      } else if (type === 'delete') {
        const r = await api('DELETE', '/api/admin/customers', { orgId: org.id, confirmName: form.confirm })
        toast.success(`${org.name} deleted`)
        if (r.warnings?.length) toast.warning(r.warnings.join(' | '))
        setDialog(null)
      }
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(user) {
    const action = user.disabled ? 'enable' : 'disable'
    try {
      await api('PATCH', '/api/admin/users', { userId: user.id, action })
      toast.success(user.disabled ? 'Login enabled' : 'Login disabled')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function exportOrg(org) {
    try { await downloadExport(org) } catch (err) { toast.error(err.message) }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast.success('Copied') } catch { toast.error('Could not copy') }
  }

  const type = dialog?.type
  const titles = {
    create: 'New customer', addUser: `Add a login to ${dialog?.org?.name}`,
    reset: 'Set a new password', removeUser: 'Remove this login', delete: `Delete ${dialog?.org?.name}`,
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Each customer has their own space. Only you can create or change logins.</p>
        </div>
        <Button onClick={() => open('create')}><Plus className="size-4" /> New customer</Button>
      </div>

      {customers === null && <Skeleton className="h-40 w-full" />}
      {customers?.length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}

      {customers?.map((org) => (
        <Section
          key={org.id}
          title={<span className="flex items-center gap-2">{org.name}{org.is_demo && <Badge variant="secondary">Demo</Badge>}</span>}
          sub={`${org.projects} project${org.projects === 1 ? '' : 's'} · ${org.flats} flat${org.flats === 1 ? '' : 's'} · created ${when(org.created_at)}`}
          action={!org.is_demo && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => open('addUser', org)}><UserPlus className="size-4" /> Add login</Button>
              <Button size="sm" variant="outline" onClick={() => exportOrg(org)}><Download className="size-4" /> Export</Button>
              <Button size="sm" variant="outline" onClick={() => open('delete', org)}><Trash2 className="size-4" /> Delete</Button>
            </div>
          )}
          flush
        >
          {org.users.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground sm:px-6">No logins.</p>
          ) : (
            <ul className="divide-y border-t">
              {org.users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{u.email || u.id}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', u.disabled ? 'bg-foreground/20' : 'bg-primary')} />
                        {u.disabled ? 'Disabled' : 'Active'}
                      </span>
                      {' · '}last sign-in {when(u.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => open('reset', org, u)}><KeyRound className="size-4" /> Password</Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(u)}>{u.disabled ? 'Enable' : 'Disable'}</Button>
                    {!org.is_demo && <Button size="sm" variant="outline" onClick={() => open('removeUser', org, u)}>Remove</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent>
          {done ? (
            <>
              <DialogHeader>
                <DialogTitle>{done.title}</DialogTitle>
                <DialogDescription>Send these details to the customer. The password is not shown again.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
                <p>Site: {typeof window !== 'undefined' ? window.location.origin : ''}</p>
                <p>Email: {done.email}</p>
                <p>Password: {done.password}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => copy(`Site: ${window.location.origin}\nEmail: ${done.email}\nPassword: ${done.password}`)}>
                  <Copy className="size-4" /> Copy details
                </Button>
                <Button onClick={close}>Done</Button>
              </DialogFooter>
            </>
          ) : dialog && (
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{titles[type]}</DialogTitle>
                {type === 'delete' && (
                  <DialogDescription>
                    This permanently deletes all of {dialog.org.name}&rsquo;s projects, flats, payments, files and logins. It cannot be undone.
                  </DialogDescription>
                )}
                {type === 'removeUser' && (
                  <DialogDescription>
                    {dialog.user.email} will no longer be able to sign in. The organization&rsquo;s data stays.
                  </DialogDescription>
                )}
                {type === 'reset' && <DialogDescription>{dialog.user.email}</DialogDescription>}
              </DialogHeader>

              {type === 'create' && (
                <Field label="Organization name">
                  <Input value={form.orgName} onChange={(e) => set('orgName')(e.target.value)} required minLength={2} maxLength={80} autoFocus />
                </Field>
              )}
              {(type === 'create' || type === 'addUser') && (
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} required autoComplete="off" />
                </Field>
              )}
              {(type === 'create' || type === 'addUser' || type === 'reset') && (
                <PasswordField value={form.password} onChange={set('password')} />
              )}
              {type === 'delete' && (
                <>
                  <Button type="button" variant="outline" onClick={() => exportOrg(dialog.org)}>
                    <Download className="size-4" /> Download their data first
                  </Button>
                  <Field label={`Type “${dialog.org.name}” to confirm`}>
                    <Input value={form.confirm} onChange={(e) => set('confirm')(e.target.value)} autoComplete="off" />
                  </Field>
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button
                  type="submit"
                  variant={type === 'delete' || type === 'removeUser' ? 'destructive' : 'default'}
                  disabled={busy || (type === 'delete' && form.confirm !== dialog.org.name)}
                >
                  {busy ? 'Working…' : type === 'delete' ? 'Delete permanently' : type === 'removeUser' ? 'Remove login' : type === 'reset' ? 'Set password' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
