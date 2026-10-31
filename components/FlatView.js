'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import StatusBadge from '@/components/StatusBadge'
import { FlatViewSkeleton } from '@/components/skeletons'

/*
  Rules used on this page
  - Every block is a Section card: title + one muted line, same padding, same hover lift.
  - Lists run edge to edge inside the card with thin dividers. Grey hover, never teal.
  - Solid teal = the one main action (Edit flat). Secondary actions are soft teal.
  - Amounts in full (inr). Colours: teal received, amber due now, grey not yet due.
  - Phone: one column. Payments show 5 rows, then Show all.
*/

const LIFT =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.22)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'
const SOFT = 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
const SLOTS = [
  { kind: 'site_plan', label: 'Site plan' },
  { kind: 'agreement', label: 'Agreement' },
]

const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
const pctOf = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0)

function Section({ title, sub, action, flush, className, children }) {
  return (
    <Card className={cn('gap-0 p-0', LIFT, className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? 'mt-4' : 'mt-4 px-5 pb-5 sm:px-6 sm:pb-6'}>{children}</div>
    </Card>
  )
}

function Row({ label, children }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children || '—'}</span>
    </li>
  )
}

export default function FlatView({ flatId }) {
  const [d, setD] = useState(null)
  const [tick, setTick] = useState(0)
  const [tax, setTax] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pay, setPay] = useState({ amount: '', paid_on: today(), note: '' })
  const [showAllPays, setShowAllPays] = useState(false) // phone only
  const [preset, setPreset] = useState('custom') // 'custom' | 'all' | stage id
  const amountRef = useRef(null)

  useEffect(() => {
    let off = false
    async function load() {
      const { data: f } = await supabase.from('flat_summary').select('*').eq('id', flatId).single()
      if (!f) return !off && setD({ missing: true })
      const { data: w } = await supabase.from('wings')
        .select('name, project_id, current_stage_id').eq('id', f.wing_id).single()
      const [{ data: c }, { data: docs }, { data: st }, { data: pays }, { data: fi }] = await Promise.all([
        supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
        supabase.from('documents').select('*').eq('flat_id', flatId).order('uploaded_at', { ascending: false }),
        supabase.from('stages').select('id, position, name').eq('project_id', w.project_id).order('position'),
        supabase.from('payments').select('*').eq('flat_id', flatId).order('paid_on', { ascending: false }),
        supabase.from('flat_installments').select('stage_id, percent').eq('flat_id', flatId),
      ])
      let urls = {}
      if (docs?.length) {
        const { data: s } = await supabase.storage.from('documents')
          .createSignedUrls(docs.map((x) => x.storage_path), 3600)
        urls = Object.fromEntries((s || []).map((x) => [x.path, x.signedUrl]))
      }
      if (!off) setD({
        f, charges: c || [], wing: w?.name, curStage: w?.current_stage_id,
        stages: st || [], inst: fi || [], pays: pays || [], docs: docs || [], urls,
      })
    }
    load()
    return () => { off = true }
  }, [flatId, tick])

  async function addPayment(e) {
    e.preventDefault()
    setSaving(true)
    const amount = Number(pay.amount)
    const { error } = await supabase.from('payments').insert({
      flat_id: flatId, amount, paid_on: pay.paid_on, note: pay.note || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(`Payment of ${inr(amount)} added`)
    setPay({ amount: '', paid_on: today(), note: '' })
    setPreset('custom')
    setAdding(false)
    setTick((t) => t + 1)
  }

  async function delPayment(p) {
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    if (error) return toast.error(error.message)
    setTick((t) => t + 1)
    toast(`Payment of ${inr(p.amount)} deleted`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const { error: e2 } = await supabase.from('payments').insert({
            id: p.id, flat_id: p.flat_id, amount: p.amount, paid_on: p.paid_on, note: p.note,
          })
          if (e2) return toast.error(e2.message)
          setTick((t) => t + 1)
        },
      },
    })
  }

  if (!d) return <FlatViewSkeleton />
  if (d.missing) {
    return (
      <div className="mx-auto max-w-7xl py-16 text-center">
        <p className="font-medium">Flat not found</p>
        <Button asChild variant="ghost" className="mt-3"><Link href="/admin/flats">Back to flats</Link></Button>
      </div>
    )
  }

  const { f, charges, wing, curStage, stages, inst, pays, docs, urls } = d
  const code = `${wing}-${f.flat_no}`
  const rows = stages
    .filter((s) => inst.some((i) => i.stage_id === s.id))
    .map((s) => ({ ...s, percent: Number(inst.find((i) => i.stage_id === s.id).percent) }))
  const agreement = Number(f.agreement_value || 0)
  const total = Number(f.total_amount || 0)
  const received = Number(f.received_amount || 0)
  const due = Number((tax ? f.due_with_charges : f.due_now) || 0)
  const later = Math.max(0, total - received - due)
  const curPos = stages.find((s) => s.id === curStage)?.position || 0
  const sumPct = Number(rows.reduce((s, r) => s + r.percent, 0).toFixed(2))
  // Match received money to installments in order
  let left = received
  const steps = rows.map((s) => {
    const amt = (agreement * s.percent) / 100
    const paid = Math.min(left, amt)
    left -= paid
    const state = paid >= amt - 0.5 ? 'paid' : s.position <= curPos ? 'due' : 'later'
    return { ...s, amt, paid, state }
  })
  // Payment presets: everything due now, plus each stage that is due and not fully paid
  const presets = [
    ...(due > 0 ? [{ key: 'all', label: tax ? 'All due now (with charges)' : 'All due now', amount: Math.round(due) }] : []),
    ...steps
      .filter((s) => s.state === 'due')
      .map((s) => ({ key: s.id, label: s.name, amount: Math.round(s.amt - s.paid) }))
      .filter((x) => x.amount > 0),
  ]
  function choosePreset(key) {
    setPreset(key)
    if (key === 'custom') {
      setPay((p) => ({ ...p, amount: '' }))
      setTimeout(() => amountRef.current?.focus(), 50)
      return
    }
    const hit = presets.find((x) => x.key === key)
    if (hit) setPay((p) => ({ ...p, amount: String(hit.amount) }))
  }
  const first = (f.holder_name || '').split(/&|,/)[0].trim()
  const msg = `Hello ${first}, as per the agreement the ${f.stage_name} stage is complete. Amount due: ${inr(due)}. Kindly arrange the payment. Thank you.`
  const wa = f.phone && due > 0 ? `https://wa.me/91${f.phone}?text=${encodeURIComponent(msg)}` : null
  const carpet = f.carpet_sqft
    ? `${f.carpet_sqft} sq.ft${f.carpet_sqm ? ` (${f.carpet_sqm} sq.m)` : ''}`
    : f.carpet_sqm ? `${f.carpet_sqm} sq.m` : ''

  const legend = [
    { label: 'Received', value: received, dot: 'bg-primary' },
    { label: 'Due now', value: due, dot: 'bg-amber-500' },
    { label: 'Not yet due', value: later, dot: 'bg-slate-300 dark:bg-slate-600' },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{code}</h1>
            <StatusBadge value={f.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {f.holder_name || 'No holder added'}{f.phone ? ` · +91 ${f.phone}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {f.is_sale && (
            <Tabs value={tax ? 'charges' : 'basic'} onValueChange={(v) => setTax(v === 'charges')}>
              <TabsList>
                <TabsTrigger value="basic">Basic due</TabsTrigger>
                <TabsTrigger value="charges">With charges</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Button asChild><Link href={`/admin/flats/${f.id}/edit`}>Edit flat</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {f.is_sale && (
            <Section
              title="Due now"
              sub={f.stage_name
                ? `${f.stage_name} · ${Number(f.stage_percent || 0)}% of agreement value due so far`
                : 'No stage set for this wing yet'}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{inr(due)}</p>
                {wa ? (
                  <Button asChild size="sm" variant="ghost" className={cn('w-24 shrink-0', SOFT)}>
                    <a href={wa} target="_blank" rel="noreferrer" aria-label={`Send WhatsApp reminder to ${first}`}>
                      <MessageCircle className="size-4" />
                      Remind
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {due <= 0 ? 'Up to date' : 'No phone number'}
                  </span>
                )}
              </div>

              <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-primary transition-all duration-700" style={{ width: `${pctOf(received, total)}%` }} />
                <div className="bg-amber-500 transition-all duration-700" style={{ width: `${pctOf(due, total)}%` }} />
                <div className="bg-slate-300 transition-all duration-700 dark:bg-slate-600" style={{ width: `${pctOf(later, total)}%` }} />
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-3">
                {legend.map((l) => (
                  <li key={l.label} className="min-w-0">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn('size-2 shrink-0 rounded-full', l.dot)} />
                      {l.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold tabular-nums">{inr(l.value)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                {pctOf(received, total).toFixed(0)}% received of {inr(total)} total
              </p>
            </Section>
          )}

          {f.is_sale && (
            <Section
              flush
              title="Payments"
              sub={pays.length === 0 ? 'Nothing received yet' : `${pays.length} ${pays.length === 1 ? 'payment' : 'payments'} · ${inr(received)} received`}
              action={
                <Button size="sm" variant="ghost" className={SOFT} onClick={() => setAdding(true)}>
                  <Plus className="size-4" />
                  Add payment
                </Button>
              }
            >
              {pays.length === 0 ? (
                <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
                  No payments yet. Add the first one.
                </p>
              ) : (
                <ul className="scroll-hover max-h-96 divide-y overflow-y-auto border-t">
                  {pays.map((p, i) => (
                    <li
                      key={p.id}
                      className={cn(
                        'items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60 sm:px-6',
                        i >= 5 && !showAllPays ? 'hidden lg:flex' : 'flex'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tabular-nums">{inr(p.amount)}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {fmtDate(p.paid_on)}{p.note ? ` · ${p.note}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete payment of ${inr(p.amount)}`}
                        onClick={() => delPayment(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                  {pays.length > 5 && (
                    <li className="px-5 py-3 text-center lg:hidden">
                      <Button variant="ghost" size="sm" onClick={() => setShowAllPays((v) => !v)}>
                        {showAllPays ? 'Show less' : `Show all ${pays.length} payments`}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </Section>
          )}

          <Section flush title="Flat details" sub="Basic information">
            <ul className="divide-y border-t">
              <Row label="Floor">{f.floor}</Row>
              <Row label="Carpet area">{carpet}</Row>
              <Row label="Phone">{f.phone && `+91 ${f.phone}`}</Row>
              <Row label="Agreement no.">{f.agreement_no}</Row>
              <Row label="Agreement date">{fmtDate(f.agreement_date)}</Row>
            </ul>
          </Section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {f.is_sale && rows.length > 0 && (
            <Section
              flush
              title="Installments"
              sub={`Percent of ${inr(agreement)} agreement value`}
            >
              <ol className="divide-y border-t">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full',
                        s.state === 'paid' && 'bg-primary text-primary-foreground',
                        s.state === 'due' && 'border-2 border-amber-500',
                        s.state === 'later' && 'border border-border'
                      )}
                    >
                      {s.state === 'paid' && <Check className="size-3" strokeWidth={3} />}
                      {s.state === 'due' && <span className="size-2 rounded-full bg-amber-500" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', s.state === 'later' && 'text-muted-foreground')}>
                        {s.name}
                      </span>
                      {s.state !== 'paid' && s.paid > 0 && (
                        <span className="block text-xs text-muted-foreground tabular-nums">{inr(s.paid)} paid</span>
                      )}
                    </span>
                    <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{s.percent}%</span>
                    <span className={cn('w-28 text-right text-sm tabular-nums', s.state === 'later' ? 'text-muted-foreground' : 'font-semibold')}>
                      {inr(s.amt)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-3 px-5 py-3 text-sm font-semibold sm:px-6">
                  <span className="size-5 shrink-0" />
                  <span className="flex-1">Total</span>
                  <span className="w-12 text-right tabular-nums">{sumPct}%</span>
                  <span className="w-28 text-right tabular-nums">{inr((agreement * sumPct) / 100)}</span>
                </li>
              </ol>
            </Section>
          )}

          {charges.length > 0 && (
            <Section flush title="Charges" sub="Agreement value plus taxes and fees">
              <ul className="divide-y border-t">
                {charges.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="tabular-nums">{inr(c.amount)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-4 px-5 py-3 text-sm font-semibold sm:px-6">
                  <span>Total</span>
                  <span className="tabular-nums">{inr(f.total_amount)}</span>
                </li>
              </ul>
            </Section>
          )}

          <Section flush title="Documents" sub="Private. Links open for one hour">
            <ul className="divide-y border-t">
              {SLOTS.map((s) => {
                const doc = docs.find((x) => x.kind === s.kind)
                return (
                  <li key={s.kind} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="truncate text-sm text-muted-foreground">{doc ? doc.file_name : 'Not uploaded'}</p>
                    </div>
                    {doc && (
                      <Button asChild size="sm" variant="ghost" className={cn('shrink-0', SOFT)}>
                        <a href={urls[doc.storage_path]} target="_blank" rel="noreferrer">View</a>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>
      </div>

      {/* Add payment */}
      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 sm:px-6">
            <SheetTitle>Add payment</SheetTitle>
            <SheetDescription>{code} · {f.holder_name || 'No holder'}</SheetDescription>
          </SheetHeader>
          <form onSubmit={addPayment} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-5 px-5 py-5 sm:px-6">
              {presets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="preset">Pay for</Label>
                  <Select value={preset} onValueChange={choosePreset}>
                    <SelectTrigger id="preset" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {presets.map((x) => (
                        <SelectItem key={x.key} value={x.key}>{x.label} · {inr(x.amount)}</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  required
                  min="1"
                  step="any"
                  autoFocus={presets.length === 0}
                  value={pay.amount}
                  onChange={(e) => {
                    setPay({ ...pay, amount: e.target.value })
                    setPreset('custom')
                  }}
                />
                <p className="min-h-4 text-xs tabular-nums text-muted-foreground">
                  {Number(pay.amount) > 0 ? inr(Number(pay.amount)) : ' '}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_on">Date</Label>
                <Input
                  id="paid_on"
                  type="date"
                  required
                  value={pay.paid_on}
                  onChange={(e) => setPay({ ...pay, paid_on: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  placeholder="e.g. cheque no., cash"
                  value={pay.note}
                  onChange={(e) => setPay({ ...pay, note: e.target.value })}
                />
              </div>
            </div>
            <SheetFooter className="border-t px-5 py-4 sm:px-6">
              <Button type="submit" disabled={saving || !pay.amount}>{saving ? 'Saving…' : 'Save payment'}</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}