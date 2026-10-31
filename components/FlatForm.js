'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import Section from '@/components/Section'
import { FormSkeleton } from '@/components/skeletons'

/*
  Layout rule: 2 equal columns, cards in the same row stretch to the same height.
  Row 1 details | holder, Row 2 account | documents, Row 3 installments (full), Row 4 delete (full).
  Phone: one column, same order.
*/

// To add car parking later, add 'Car parking' to this list.
const CHARGE_NAMES = ['Agreement value', 'Stamp duty & registration', 'MSEB', 'Legal', 'GST']
const SLOTS = [
  { kind: 'site_plan', label: 'Site plan' },
  { kind: 'agreement', label: 'Agreement' },
]
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2'
const OPTION =
  'rounded-lg border p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring'
const OPTION_ON = 'border-primary bg-primary/5 hover:bg-primary/5'
const GREEN = 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'

const empty = {
  wing_id: '', flat_no: '', floor: '', carpet_sqm: '', carpet_sqft: '',
  status: '', holder_name: '', phone: '', agreement_no: '', agreement_date: '',
}

function Field({ id, label, required, className, children }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  )
}

function PendingSlot({ slot, file, onPick }) {
  const ref = useRef(null)
  const [error, setError] = useState('')

  function choose(f) {
    if (!f) return
    const ok = f.type === 'application/pdf' || f.type.startsWith('image/')
    if (!ok) return setError('Please choose a PDF or an image.')
    if (f.size > 20 * 1024 * 1024) return setError('File is too large (maximum 20 MB).')
    setError('')
    onPick(f)
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{slot.label}</p>
        <Badge variant="secondary" className={cn('border-0 font-medium', file ? GREEN : 'bg-muted text-muted-foreground')}>
          {file ? 'Selected' : 'Optional'}
        </Badge>
      </div>
      <input ref={ref} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => choose(e.target.files?.[0])} />
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()}>
          {file ? 'Change file' : 'Choose file'}
        </Button>
        {file && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{file.name}</span>
            <Button type="button" size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => { onPick(null); if (ref.current) ref.current.value = '' }}>
              Remove
            </Button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default function FlatForm({ flatId, children }) {
  const router = useRouter()
  const [wings, setWings] = useState([])
  const [statuses, setStatuses] = useState([])
  const [form, setForm] = useState(empty)
  const [charges, setCharges] = useState({})
  const [files, setFiles] = useState({})
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stages, setStages] = useState([])
  const [templates, setTemplates] = useState([])
  const [inst, setInst] = useState({}) // stage_id -> percent (string). A key means the stage is used.
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: s }, { data: st }, { data: tp }] = await Promise.all([
        supabase.from('wings').select('id, name').order('name'),
        supabase.from('statuses').select('name, counts_in_sales').order('name'),
        supabase.from('stages').select('id, name, position').order('position'),
        supabase.from('installment_templates')
          .select('id, name, template_items(stage_id, percent)').order('name'),
      ])
      setWings(w || [])
      setStatuses(s || [])
      setStages(st || [])
      setTemplates(tp || [])

      if (flatId) {
        const [{ data: flat }, { data: ch }, { data: fi }] = await Promise.all([
          supabase.from('flats').select('*').eq('id', flatId).single(),
          supabase.from('flat_charges').select('name, amount').eq('flat_id', flatId),
          supabase.from('flat_installments').select('stage_id, percent').eq('flat_id', flatId),
        ])
        setInst(Object.fromEntries((fi || []).map((x) => [x.stage_id, String(x.percent)])))
        if (flat) {
          const filled = {}
          Object.keys(empty).forEach((k) => { filled[k] = flat[k] ?? '' })
          setForm(filled)
          setUpdatedAt(flat.updated_at)
        }
        setCharges(Object.fromEntries((ch || []).map((c) => [c.name, c.amount])))
      } else if (w?.length) {
        setForm((f) => ({ ...f, wing_id: w[0].id }))
      }
      setLoading(false)
    }
    load()
  }, [flatId])

  const upd = (key, v) => setForm((f) => ({ ...f, [key]: v }))
  const bind = (key) => ({ value: form[key], onChange: (e) => upd(key, e.target.value) })

  const isSale = !!statuses.find((s) => s.name === form.status)?.counts_in_sales
  const chargeTotal = CHARGE_NAMES.reduce((t, n) => t + (Number(charges[n]) || 0), 0)

  // Installments: which option is selected
  const rowsI = stages.filter((s) => s.id in inst)
  const unused = stages.filter((s) => !(s.id in inst))
  const instTotal = Math.round(rowsI.reduce((t, s) => t + (Number(inst[s.id]) || 0), 0) * 100) / 100
  const filledKeys = rowsI.filter((s) => Number(inst[s.id]) > 0)
  const sameAs = (t) =>
    filledKeys.length === t.template_items.length &&
    t.template_items.every((i) => Number(inst[i.stage_id]) === Number(i.percent))
  const matched = templates.find(sameAs)
  const active = custom ? 'custom' : matched ? matched.id : rowsI.length ? 'custom' : null
  const isCustom = active === 'custom'

  function pickTemplate(t) {
    setCustom(false)
    setInst(Object.fromEntries(t.template_items.map((i) => [i.stage_id, String(i.percent)])))
  }
  function changeStage(oldId, newId) {
    setInst((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k === oldId ? newId : k, v])))
  }
  function removeStage(id) {
    setInst((p) => { const n = { ...p }; delete n[id]; return n })
  }
  function addStage() {
    if (!unused.length) return
    setCustom(true)
    setInst((p) => ({ ...p, [unused[0].id]: '' }))
  }

  // Required fields. Holder is not needed for flats that are For Sale.
  const missing = []
  if (!form.wing_id) missing.push('wing')
  if (!form.flat_no.trim()) missing.push('flat number')
  if (!String(form.floor).trim()) missing.push('floor')
  if (!form.status) missing.push('status')
  if (form.status !== 'For Sale' && !String(form.holder_name).trim()) missing.push('holder name')

  function fail(err, prefix = '') {
    const msg = err.code === '23505'
      ? 'That flat number already exists in this wing.'
      : prefix + err.message
    setError(msg)
    toast.error(msg)
    setSaving(false)
  }

  async function save(e) {
    e.preventDefault()
    if (missing.length) return
    setSaving(true)
    setError('')

    const payload = {
      wing_id: form.wing_id,
      flat_no: form.flat_no.trim(),
      floor: form.floor || null,
      carpet_sqm: form.carpet_sqm || null,
      carpet_sqft: form.carpet_sqft || null,
      status: form.status || null,
      holder_name: form.holder_name || null,
      phone: form.phone.replace(/\D/g, '').slice(-10) || null,
      agreement_no: form.agreement_no || null,
      agreement_date: form.agreement_date || null,
    }

    let id = flatId
    if (flatId) {
      const { error: err } = await supabase.from('flats').update(payload).eq('id', flatId)
      if (err) return fail(err)
    } else {
      const { data, error: err } = await supabase.from('flats').insert(payload).select().single()
      if (err) return fail(err)
      id = data.id
    }

    const keep = CHARGE_NAMES.filter((n) => Number(charges[n]))
    const drop = CHARGE_NAMES.filter((n) => !Number(charges[n]))

    if (keep.length) {
      const rows = keep.map((n) => ({ flat_id: id, name: n, amount: Number(charges[n]) }))
      const { error: err } = await supabase
        .from('flat_charges').upsert(rows, { onConflict: 'flat_id,name' })
      if (err) return fail(err, 'Flat saved, but charges failed: ')
    }
    if (flatId && drop.length) {
      const { error: err } = await supabase
        .from('flat_charges').delete().eq('flat_id', id).in('name', drop)
      if (err) return fail(err, 'Flat saved, but charges failed: ')
    }
    if (isSale) {
      const keepI = stages.filter((s) => Number(inst[s.id]) > 0)
      const dropI = stages.filter((s) => !(Number(inst[s.id]) > 0))
      if (keepI.length) {
        const { error: err } = await supabase.from('flat_installments').upsert(
          keepI.map((s) => ({ flat_id: id, stage_id: s.id, percent: Number(inst[s.id]) })),
          { onConflict: 'flat_id,stage_id' })
        if (err) return fail(err, 'Flat saved, but installments failed: ')
      }
      if (flatId && dropI.length) {
        const { error: err } = await supabase.from('flat_installments')
          .delete().eq('flat_id', id).in('stage_id', dropI.map((s) => s.id))
        if (err) return fail(err, 'Flat saved, but installments failed: ')
      }
    }

    // Upload files chosen on the Add page.
    let uploadFailed = false
    if (!flatId) {
      for (const slot of SLOTS) {
        const file = files[slot.kind]
        if (!file) continue
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `flats/${id}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
        if (upErr) { uploadFailed = true; continue }
        const { error: dbErr } = await supabase.from('documents').insert({
          flat_id: id, kind: slot.kind, file_name: file.name, storage_path: path,
        })
        if (dbErr) {
          await supabase.storage.from('documents').remove([path])
          uploadFailed = true
        }
      }
    }

    if (uploadFailed) {
      toast.error('Flat saved, but a file did not upload. Please upload it again here.')
      return router.push(`/admin/flats/${id}/edit`)
    }
    toast.success('Flat saved')
    router.push(flatId ? `/admin/flats/${flatId}` : '/admin/flats')
  }

  async function remove() {
    const { data: docs } = await supabase.from('documents').select('storage_path').eq('flat_id', flatId)
    if (docs?.length) await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
    const { error: err } = await supabase.from('flats').delete().eq('id', flatId)
    if (err) return toast.error(err.message)
    toast.success('Flat deleted')
    router.push('/admin/flats')
  }

  if (loading) return <FormSkeleton />

  const cancel = () => router.push(flatId ? `/admin/flats/${flatId}` : '/admin/flats')
  const needed = missing.length > 0 && (
    <p className="text-xs text-muted-foreground">Still needed: {missing.join(', ')}</p>
  )
  const saveBtn = (
    <Button type="submit" disabled={saving || missing.length > 0}>{saving ? 'Saving…' : 'Save flat'}</Button>
  )
  const cancelBtn = <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>

  return (
    <form onSubmit={save} className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{flatId ? 'Edit flat' : 'Add flat'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {flatId ? 'Update details, charges and installments' : 'Fill in the details of a new flat'}
          </p>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          {needed}
          {cancelBtn}
          {saveBtn}
        </div>
      </div>

      {/* Two equal columns. Cards in the same row stretch to the same height. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Row 1 */}
        <Section title="Flat details" sub="Where the flat is and how big">
          <div className={GRID}>
            <Field id="wing" label="Wing" required>
              <Select value={form.wing_id} onValueChange={(v) => upd('wing_id', v)}>
                <SelectTrigger id="wing" className="w-full"><SelectValue placeholder="Select wing" /></SelectTrigger>
                <SelectContent>
                  {wings.map((w) => <SelectItem key={w.id} value={w.id}>Wing {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="flat_no" label="Flat number" required>
              <Input id="flat_no" {...bind('flat_no')} />
            </Field>
            <Field id="floor" label="Floor" required>
              <Input id="floor" placeholder="e.g. 2nd Floor" {...bind('floor')} />
            </Field>
            <Field id="status" label="Status" required>
              <Select value={form.status} onValueChange={(v) => upd('status', v)}>
                <SelectTrigger id="status" className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="sqm" label="Carpet area (sq.m)">
              <Input id="sqm" type="number" inputMode="decimal" step="0.01" {...bind('carpet_sqm')} />
            </Field>
            <Field id="sqft" label="Carpet area (sq.ft)">
              <Input id="sqft" type="number" inputMode="decimal" step="0.01" {...bind('carpet_sqft')} />
            </Field>
          </div>
        </Section>

        <Section title="Holder and agreement" sub="Who owns it and the agreement details">
          <div className={GRID}>
            <Field id="holder" label="Name of flat holder(s)" required={form.status !== 'For Sale'} className="sm:col-span-2">
              <Input id="holder" placeholder="Joint holders: Name 1 & Name 2" {...bind('holder_name')} />
            </Field>
            <Field id="phone" label="Phone (for WhatsApp)">
              <Input id="phone" type="tel" inputMode="numeric" placeholder="10-digit mobile number" {...bind('phone')} />
            </Field>
            <Field id="agr_no" label="Agreement number">
              <Input id="agr_no" {...bind('agreement_no')} />
            </Field>
            <Field id="agr_date" label="Agreement date">
              <Input id="agr_date" type="date" {...bind('agreement_date')} />
            </Field>
          </div>
        </Section>

        {/* Row 2 */}
        <Section
          title="Account (₹)"
          sub={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString('en-IN')}` : 'Agreement value plus taxes and fees'}
        >
          <div className={GRID}>
            {CHARGE_NAMES.map((n, i) => (
              <Field key={n} id={`ch${i}`} label={n}>
                <Input
                  id={`ch${i}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={charges[n] ?? ''}
                  onChange={(e) => setCharges({ ...charges, [n]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">Total (calculated)</span>
            <span className="font-semibold tabular-nums">{inr(chargeTotal)}</span>
          </div>
        </Section>

        {flatId ? children : (
          <Section title="Documents" sub="Optional. Files upload when you save the flat">
            <div className="space-y-3">
              {SLOTS.map((slot) => (
                <PendingSlot
                  key={slot.kind}
                  slot={slot}
                  file={files[slot.kind]}
                  onPick={(f) => setFiles({ ...files, [slot.kind]: f })}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Row 3: full width */}
        {isSale && (
          <Section
            className="lg:col-span-2"
            title="Installments"
            sub="Percent of agreement value, per stage"
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active === t.id}
                  onClick={() => pickTemplate(t)}
                  className={cn(OPTION, active === t.id && OPTION_ON)}
                >
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.template_items.length} installments
                  </span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={isCustom}
                onClick={() => setCustom(true)}
                className={cn(OPTION, isCustom && OPTION_ON)}
              >
                <span className="block text-sm font-medium">Custom</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Pick stages and percents</span>
              </button>
            </div>

            {rowsI.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Pick a template, or choose Custom and add stages.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {rowsI.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    {isCustom ? (
                      <Select value={s.id} onValueChange={(v) => changeStage(s.id, v)}>
                        <SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[s, ...unused].sort((a, b) => a.position - b.position).map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                    )}
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      aria-label={`${s.name} percent`}
                      className="h-9 w-24 text-right"
                      value={inst[s.id] ?? ''}
                      onChange={(e) => setInst((p) => ({ ...p, [s.id]: e.target.value }))}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    {isCustom && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => removeStage(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isCustom && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-3 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                disabled={unused.length === 0}
                onClick={addStage}
              >
                <Plus className="size-4" />
                Add stage
              </Button>
            )}

            <div className="mt-5">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('transition-all duration-500', instTotal === 100 ? 'bg-primary' : 'bg-amber-500')}
                  style={{ width: `${Math.max(0, Math.min(100, instTotal))}%` }}
                />
              </div>
              <p className={cn('mt-2 text-sm tabular-nums', instTotal === 100 ? 'text-primary' : 'text-amber-600 dark:text-amber-400')}>
                Total {instTotal}%{instTotal !== 100 && ' (should be 100%)'}
              </p>
            </div>
          </Section>
        )}

        {/* Row 4: full width */}
        {flatId && (
          <Section className="lg:col-span-2" title="Delete flat" sub="Removes this flat and everything attached to it">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
                  Delete flat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this flat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the flat with its charges, installments, payments and documents.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>
                    Delete flat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Phone: save bar floats above the bottom tab bar */}
      <div className="sticky bottom-[4.5rem] z-20 flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-lg md:hidden">
        {needed}
        <div className="grid grid-cols-2 gap-3">
          {cancelBtn}
          {saveBtn}
        </div>
      </div>
    </form>
  )
}