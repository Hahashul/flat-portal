'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CircleCheck, MessageCircle, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/lib/workspace'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DashboardSkeleton } from '@/components/skeletons'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/*
  Rules used on this page
  - Every amount is shown in full (inr), never abbreviated.
  - Every card: padding 20 / 24, title + one muted line.
  - Colour meaning: teal = received, amber = due now, grey = not yet due.
  - Teal buttons are for actions only.
*/

const sum = (arr, key) => arr.reduce((s, x) => s + Number(x[key] || 0), 0)
const pctOf = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0)
const LIFT =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.22)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'
const CARD = `gap-0 px-5 py-5 sm:px-6 sm:py-6 ${LIFT}`

function waLink(f) {
  const first = (f.holder_name || '').split(/&|,/)[0].trim()
  const msg = `Hello ${first}, as per the agreement the ${f.stage_name} stage is complete. Amount due: ${inr(f.due_now)}. Kindly arrange the payment. Thank you.`
  return f.phone ? `https://wa.me/91${f.phone}?text=${encodeURIComponent(msg)}` : null
}

function useCountUp(target) {
  const [v, setV] = useState(target)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const start = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 700)
      const e = 1 - Math.pow(1 - p, 3)
      setV(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

function CardHead({ title, sub }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  )
}

function Kpi({ label, value, sub }) {
  return (
    <Card className={CARD}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl lg:text-3xl">{value}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{sub}</p>
    </Card>
  )
}

/* Donut: plain SVG, no library */
function Donut({ parts }) {
  const R = 52
  const C = 2 * Math.PI * R
  const total = parts.reduce((s, p) => s + p.value, 0)
  let acc = 0
  return (
    <svg viewBox="0 0 140 140" className="size-32 shrink-0 -rotate-90 sm:size-36" role="img" aria-label="Collection split">
      <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-muted" />
      {total > 0 && parts.map((p) => {
        const len = (p.value / total) * C
        const el = (
          <circle
            key={p.label}
            cx="70" cy="70" r={R} fill="none" strokeWidth="16"
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
            strokeDashoffset={-acc}
            className={cn('transition-all duration-700', p.stroke)}
          />
        )
        acc += len
        return el
      })}
    </svg>
  )
}

export default function Dashboard() {
  const { projectId, readOnly } = useWorkspace()
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState([])
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tax, setTax] = useState(false)
  const [showAll, setShowAll] = useState(false) // phone only: list shows 5 rows until expanded

  const load = useCallback(async () => {
    const [{ data: w }, { data: s }] = await Promise.all([
      supabase.from('wings').select('id, name, current_stage_id').eq('project_id', projectId).order('name'),
      supabase.from('stages').select('id, name, position').eq('project_id', projectId).order('position'),
    ])
    const ids = (w || []).map((x) => x.id)
    const { data: f } = ids.length
      ? await supabase.from('flat_summary').select('*').in('wing_id', ids)
      : { data: [] }
    setFlats(f || []); setWings(w || []); setStages(s || []); setLoading(false)
    return f || []
  }, [projectId])
  useEffect(() => { load() }, [load])

  async function setStage(wing, stageId) {
    const value = stageId === 'none' ? null : stageId
    setWings((ws) => ws.map((w) => (w.id === wing.id ? { ...w, current_stage_id: value } : w)))
    const { error } = await supabase.from('wings').update({ current_stage_id: value }).eq('id', wing.id)
    if (error) { toast.error(error.message); load(); return }
    const fresh = await load()
    if (!value) return toast.success(`Wing ${wing.name} set to not started`)
    const key = tax ? 'due_with_charges' : 'due_now'
    const wingDue = fresh
      .filter((f) => f.is_sale && f.wing_id === wing.id)
      .reduce((s, f) => s + Number(f[key] || 0), 0)
    const name = stages.find((s) => s.id === value)?.name
    toast.success(`Wing ${wing.name} at ${name}, ${inr(wingDue)} now due`)
  }

  const sold = flats
    .map((f) => ({ ...f, due_now: tax ? f.due_with_charges : f.due_now }))
    .filter((f) => f.is_sale)
  const received = sum(sold, 'received_amount')
  const total = sum(sold, 'total_amount')
  const dueNow = sum(sold, 'due_now')
  const later = Math.max(0, total - received - dueNow)
  const collect = sold.filter((f) => Number(f.due_now) > 0)
    .sort((a, b) => Number(b.due_now) - Number(a.due_now))
  const wname = (id) => wings.find((w) => w.id === id)?.name || '?'
  const shownDue = useCountUp(dueNow)

  if (loading) return <DashboardSkeleton />

  const legend = [
    { label: 'Received', value: received, stroke: 'stroke-primary', dot: 'bg-primary' },
    { label: 'Due now', value: dueNow, stroke: 'stroke-amber-500', dot: 'bg-amber-500' },
    { label: 'Not yet due', value: later, stroke: 'stroke-slate-300 dark:stroke-slate-600', dot: 'bg-slate-300 dark:bg-slate-600' },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <Tabs value={tax ? 'charges' : 'basic'} onValueChange={(v) => setTax(v === 'charges')}>
          <TabsList>
            <TabsTrigger value="basic">Basic due</TabsTrigger>
            <TabsTrigger value="charges">With charges</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI strip: four identical cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Collect now"
          value={inr(Math.round(shownDue))}
          sub={collect.length === 0 ? 'Nobody owes anything' : `From ${collect.length} ${collect.length === 1 ? 'flat' : 'flats'}`}
        />
        <Kpi label="Received" value={inr(received)} sub={`${pctOf(received, total).toFixed(0)}% of total value`} />
        <Kpi label="Balance" value={inr(Math.max(0, total - received))} sub="Still to receive" />
        <Kpi label="Sold flats" value={sold.length} sub={`${flats.length} flats in total`} />
      </div>

      {/* Main: both columns always end at the same height */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: scrolls inside itself, never changes the row height */}
        <Card className={cn('relative gap-0 p-0 lg:col-span-7 lg:min-h-[26rem]', LIFT)}>
          <div className="flex flex-col py-5 sm:py-6 lg:absolute lg:inset-0">
            <div className="px-5 sm:px-6">
              <CardHead title="Who to collect from" sub="Highest amount first" />
            </div>

            {collect.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  {sold.length === 0 ? <Plus className="size-6" /> : <CircleCheck className="size-6" />}
                </span>
                <div>
                  <p className="font-medium">{sold.length === 0 ? 'No sold flats yet' : 'All caught up'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sold.length === 0
                      ? 'Add a flat and mark it Sold to start tracking dues.'
                      : 'Nothing is due at the current stage.'}
                  </p>
                </div>
                {sold.length === 0 && !readOnly && (
                  <Button asChild size="sm"><Link href="/app/flats/new">Add your first flat</Link></Button>
                )}
              </div>
            ) : (
              <ul className="scroll-hover mt-4 divide-y border-t lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {collect.map((f, i) => {
                  const wa = waLink(f)
                  const name = f.holder_name || '—'
                  return (
                    <li key={f.id} className={cn('items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60 sm:px-6', i >= 5 && !showAll ? 'hidden lg:flex' : 'flex')}>
                      <Link href={`/app/flats/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{wname(f.wing_id)}-{f.flat_no}</span>
                          <span className="block truncate text-sm text-muted-foreground">{name}</span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{inr(f.due_now)}</span>
                      </Link>
                      {wa ? (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="w-24 shrink-0 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                        >
                          <a href={wa} target="_blank" rel="noreferrer" aria-label={`Send WhatsApp reminder to ${name}`}>
                            <MessageCircle className="size-4" />
                            Remind
                          </a>
                        </Button>
                      ) : (
                        <span className="w-24 shrink-0 text-center text-xs text-muted-foreground">No phone</span>
                      )}
                    </li>
                  )
                })}
                {collect.length > 5 && (
                  <li className="px-5 py-3 text-center lg:hidden">
                    <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                      {showAll ? 'Show less' : `Show all ${collect.length} flats`}
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className={CARD}>
            <CardHead title="Collection split" sub="Across all sold flats" />
            <div className="mt-4 flex items-center gap-6">
              <div className="relative">
                <Donut parts={legend} />
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{pctOf(received, total).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">received</p>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-3">
                {legend.map((l) => (
                  <li key={l.label} className="flex items-center gap-3">
                    <span className={cn('size-2.5 shrink-0 rounded-full', l.dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{l.label}</span>
                      <span className="block truncate text-sm font-semibold tabular-nums">{inr(l.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className={CARD}>
            <CardHead title="Wings" sub="Set the current construction stage" />
            <div className="mt-4 divide-y">
              {wings.map((w) => {
                const ws = sold.filter((f) => f.wing_id === w.id)
                const wRec = sum(ws, 'received_amount')
                const wDue = sum(ws, 'due_now')
                const wTot = sum(ws, 'total_amount')
                const wLater = Math.max(0, wTot - wRec - wDue)
                return (
                  <div key={w.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Wing {w.name}</p>
                      <Select value={w.current_stage_id || 'none'} onValueChange={(v) => setStage(w, v)} disabled={readOnly}>
                        <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not started</SelectItem>
                          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div className="bg-primary transition-all duration-700" style={{ width: `${pctOf(wRec, wTot)}%` }} />
                      <div className="bg-amber-500 transition-all duration-700" style={{ width: `${pctOf(wDue, wTot)}%` }} />
                      <div className="bg-slate-300 dark:bg-slate-600 transition-all duration-700" style={{ width: `${pctOf(wLater, wTot)}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Received</p>
                        <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">{inr(wRec)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Due now</p>
                        <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">{inr(wDue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sold flats</p>
                        <p className="mt-0.5 font-medium tabular-nums text-foreground">{ws.length}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}