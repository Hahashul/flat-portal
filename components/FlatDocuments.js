'use client'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import Section from '@/components/Section'

const SLOTS = [
  { kind: 'site_plan', label: 'Site plan', hint: 'The floor plan of this flat' },
  { kind: 'agreement', label: 'Agreement', hint: 'The signed agreement' },
]
const GREEN = 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'

function Slot({ flatId, slot, docs, urls, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const current = docs[0] // newest first

  async function handleFile(file) {
    if (!file) return
    setError('')
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/')
    if (!okType) return setError('Please choose a PDF or an image.')
    if (file.size > 20 * 1024 * 1024) return setError('File is too large (maximum 20 MB).')

    setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `flats/${flatId}/${Date.now()}-${safe}`

    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) { toast.error(upErr.message); setBusy(false); return }

    const { error: dbErr } = await supabase.from('documents').insert({
      flat_id: flatId, kind: slot.kind, file_name: file.name, storage_path: path,
    })
    if (dbErr) {
      await supabase.storage.from('documents').remove([path])
      toast.error(dbErr.message); setBusy(false); return
    }

    // The new file is saved, so it is now safe to remove the old one(s).
    if (docs.length) {
      await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
      await supabase.from('documents').delete().in('id', docs.map((d) => d.id))
    }
    if (inputRef.current) inputRef.current.value = ''
    setBusy(false)
    toast.success(`${slot.label} uploaded`)
    onChange()
  }

  async function remove() {
    setBusy(true)
    await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
    await supabase.from('documents').delete().in('id', docs.map((d) => d.id))
    setBusy(false)
    toast.success(`${slot.label} deleted`)
    onChange()
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{slot.label}</p>
          <p className="text-xs text-muted-foreground">{slot.hint}</p>
        </div>
        <Badge variant="secondary" className={cn('shrink-0 border-0 font-medium', current ? GREEN : 'bg-muted text-muted-foreground')}>
          {current ? 'Uploaded' : 'Not uploaded'}
        </Badge>
      </div>

      <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />

      {current ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={urls[current.storage_path]}
            target="_blank"
            rel="noreferrer"
            className="block min-w-0 truncate text-sm font-medium text-primary hover:underline"
          >
            {current.file_name}
          </a>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={busy} className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete the {slot.label.toLowerCase()}?</AlertDialogTitle>
                  <AlertDialogDescription>The file is removed for good. You can upload it again later.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={cn(
            'rounded-lg border-2 border-dashed py-6 text-center transition-colors',
            drag ? 'border-primary bg-primary/5' : 'bg-muted/30'
          )}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">or drag a PDF / image here · max 20 MB</p>
        </div>
      )}

      {busy && <p className="mt-2 text-sm text-muted-foreground">Working…</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default function FlatDocuments({ flatId }) {
  const [docs, setDocs] = useState([])
  const [urls, setUrls] = useState({})

  async function load() {
    const { data } = await supabase
      .from('documents').select('*').eq('flat_id', flatId)
      .order('uploaded_at', { ascending: false })
    setDocs(data || [])
    if (data?.length) {
      const { data: signed } = await supabase.storage
        .from('documents').createSignedUrls(data.map((d) => d.storage_path), 3600)
      setUrls(Object.fromEntries((signed || []).map((s) => [s.path, s.signedUrl])))
    } else {
      setUrls({})
    }
  }
  useEffect(() => { load() }, [flatId])

  return (
    <Section title="Documents" sub="Files upload as soon as you choose them">
      <div className="space-y-3">
        {SLOTS.map((slot) => (
          <Slot key={slot.kind} flatId={flatId} slot={slot}
            docs={docs.filter((d) => d.kind === slot.kind)} urls={urls} onChange={load} />
        ))}
      </div>
    </Section>
  )
}