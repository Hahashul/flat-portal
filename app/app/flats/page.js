'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/lib/workspace'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FlatsSkeleton } from '@/components/skeletons'

/*
  Rules used on this page
  - No big container. Every flat is its own soft card with space between cards.
  - Same hover as every other card: lift 2px + soft shadow (off for reduced motion).
  - Hover colour is neutral, never teal. Teal only for Add flat and the active toggle.
  - Amounts in full (inr), plain text. Flats that are not sold show a dash.
  - Phone: same cards, 5 shown, then Show all.
*/

const LIFT =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.22)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'

// One grid for the header and every row, so columns always line up.
const COLS = 'md:grid-cols-[minmax(0,1fr)_6.5rem_9rem_9rem_9rem]'

const STATUS_STYLE = {
  Sold: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  Tenant: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  Owner: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  'For Sale': 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'No status': 'bg-muted text-muted-foreground',
}

function Status({ value }) {
  const s = value || 'No status'
  return (
    <Badge variant="secondary" className={cn('border-0 font-medium', STATUS_STYLE[s] || STATUS_STYLE['No status'])}>
      {s}
    </Badge>
  )
}

function Money({ value }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{inr(value)}</span>
}

function DueCell({ value }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (value <= 0) return <span className="text-muted-foreground">Up to date</span>
  return <span className="font-semibold tabular-nums">{inr(value)}</span>
}

function SortHead({ label, k, sort, onSort, align = 'left' }) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      onClick={() => onSort(k)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        active && 'text-foreground',
        align === 'right' ? 'flex-row-reverse justify-self-end' : 'justify-self-start'
      )}
    >
      {label}
      <Icon className={cn('size-3.5', !active && 'opacity-50')} />
    </button>
  )
}

export default function Flats() {
  const { projectId, readOnly } = useWorkspace()
  const [flats, setFlats] = useState([])
  const [wings, setWings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tax, setTax] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [wing, setWing] = useState('all')
  const [sort, setSort] = useState({ key: 'flat', dir: 'asc' })
  const [showAll, setShowAll] = useState(false) // phone only

  useEffect(() => {
    async function load() {
      const { data: w } = await supabase.from('wings').select('id, name').eq('project_id', projectId).order('name')
      const ids = (w || []).map((x) => x.id)
      const { data: f } = ids.length
        ? await supabase.from('flat_summary').select('*').in('wing_id', ids)
        : { data: [] }
      setFlats(f || [])
      setWings(w || [])
      setLoading(false)
    }
    load()
  }, [projectId])

  const statusOf = (f) => f.status || 'No status'

  const rows = useMemo(() => {
    const byFlat = (a, b) =>
      a.wingName.localeCompare(b.wingName) || String(a.flat_no).localeCompare(String(b.flat_no), undefined, { numeric: true })
    const num = (key) => (a, b) => (a[key] ?? -1) - (b[key] ?? -1)
    const sorters = {
      flat: byFlat,
      status: (a, b) => statusOf(a).localeCompare(statusOf(b)),
      total: num('total'),
      received: num('received'),
      due: num('due'),
    }
    const q = search.trim().toLowerCase()
    return flats
      .map((f) => ({
        ...f,
        wingName: wings.find((w) => w.id === f.wing_id)?.name || '?',
        total: f.is_sale ? Number(f.total_amount || 0) : null,
        received: f.is_sale ? Number(f.received_amount || 0) : null,
        due: f.is_sale ? Number((tax ? f.due_with_charges : f.due_now) || 0) : null,
      }))
      .filter((f) => status === 'all' || statusOf(f) === status)
      .filter((f) => wing === 'all' || f.wing_id === wing)
      .filter((f) => `${f.wingName}-${f.flat_no} ${f.holder_name || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const r = sorters[sort.key](a, b) || byFlat(a, b)
        return sort.dir === 'asc' ? r : -r
      })
  }, [flats, wings, tax, search, status, wing, sort])

  const statusOptions = useMemo(() => [...new Set(flats.map((f) => f.status || 'No status'))].sort(), [flats])

  function onSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  if (loading) return <FlatsSkeleton />

  const filtered = search || status !== 'all' || wing !== 'all'
  const visible = showAll ? rows : rows.slice(0, 5)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Flats</h1>
        <div className="flex items-center gap-3">
          <Tabs value={tax ? 'charges' : 'basic'} onValueChange={(v) => setTax(v === 'charges')}>
            <TabsList>
              <TabsTrigger value="basic">Basic due</TabsTrigger>
              <TabsTrigger value="charges">With charges</TabsTrigger>
            </TabsList>
          </Tabs>
          {!readOnly && <Button asChild><Link href="/app/flats/new">Add flat</Link></Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flat or name"
            className="h-9 pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={wing} onValueChange={setWing}>
          <SelectTrigger className="h-9 w-full sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wings</SelectItem>
            {wings.map((w) => <SelectItem key={w.id} value={w.id}>Wing {w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {rows.length === flats.length ? `${flats.length} flats` : `${rows.length} of ${flats.length} flats`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="font-medium">{filtered ? 'No flats match' : 'No flats yet'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? 'Try a different search or filter.' : 'Add your first flat to get started.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Sort row (desktop only). Same grid and padding as the rows below. */}
          <div className={cn('hidden items-center gap-5 border border-transparent px-5 md:grid', COLS)}>
            <SortHead label="Flat" k="flat" sort={sort} onSort={onSort} />
            <SortHead label="Status" k="status" sort={sort} onSort={onSort} />
            <SortHead label="Total" k="total" sort={sort} onSort={onSort} align="right" />
            <SortHead label="Received" k="received" sort={sort} onSort={onSort} align="right" />
            <SortHead label="Due" k="due" sort={sort} onSort={onSort} align="right" />
          </div>

          {/* Desktop: all rows. Phone: 5 until Show all. */}
          {rows.map((f, i) => (
            <Link
              key={f.id}
              href={`/app/flats/${f.id}`}
              className={cn(
                'items-center gap-3 rounded-xl border bg-card px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid md:gap-5',
                COLS,
                LIFT,
                i >= 5 && !showAll ? 'hidden md:grid' : 'flex'
              )}
            >
              {/* Flat + name */}
              <span className="min-w-0 flex-1 md:flex md:items-baseline md:gap-5">
                <span className="block font-semibold md:w-20 md:shrink-0">{f.wingName}-{f.flat_no}</span>
                <span className="block truncate text-sm text-muted-foreground md:text-base">{f.holder_name || 'No holder'}</span>
              </span>

              {/* Phone: due + status stacked */}
              <span className="flex shrink-0 flex-col items-end gap-1.5 text-sm md:hidden">
                <DueCell value={f.due} />
                <Status value={f.status} />
              </span>

              {/* Desktop columns */}
              <span className="hidden md:block"><Status value={f.status} /></span>
              <span className="hidden whitespace-nowrap text-right md:block"><Money value={f.total} /></span>
              <span className="hidden whitespace-nowrap text-right md:block"><Money value={f.received} /></span>
              <span className="hidden whitespace-nowrap text-right md:block"><DueCell value={f.due} /></span>
            </Link>
          ))}

          {rows.length > 5 && (
            <div className="text-center md:hidden">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show less' : `Show all ${rows.length} flats`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}