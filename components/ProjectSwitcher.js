'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// "A, B, C" -> ['A', 'B', 'C'] (trimmed, no blanks, no duplicates, at most 20)
function parseWings(text) {
  const seen = new Set()
  return text.split(/[,\n]/).map((x) => x.trim()).filter((x) => {
    const k = x.toLowerCase()
    if (!x || seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 20)
}

export function NewProjectForm({ orgId, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [wingText, setWingText] = useState('')
  const [busy, setBusy] = useState(false)
  const wings = parseWings(wingText)
  const valid = name.trim().length >= 2 && wings.length > 0 && wings.every((w) => w.length <= 20)

  async function submit(e) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const { data: p, error } = await supabase
      .from('projects').insert({ name: name.trim(), org_id: orgId }).select('id').single()
    if (error) { setBusy(false); return toast.error(error.message) }
    const { error: wErr } = await supabase.from('wings').insert(wings.map((w) => ({ project_id: p.id, name: w })))
    if (wErr) {
      await supabase.from('projects').delete().eq('id', p.id)
      setBusy(false)
      return toast.error(wErr.message)
    }
    setBusy(false)
    toast.success(`Project \u201c${name.trim()}\u201d created`)
    onCreated(p.id)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pname">Project name</Label>
        <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pwings">Wings</Label>
        <Input id="pwings" value={wingText} onChange={(e) => setWingText(e.target.value)} placeholder="A, B" />
        <p className="text-xs text-muted-foreground">Separate names with commas. Each flat belongs to a wing.</p>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={!valid || busy}>{busy ? 'Creating\u2026' : 'Create project'}</Button>
      </div>
    </form>
  )
}

export default function ProjectSwitcher({ projects, projectId, onChange, orgId, onCreated, readOnly }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1">
      <Select value={projectId || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-32 sm:w-52" aria-label="Project"><SelectValue /></SelectTrigger>
        <SelectContent>
          {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {!readOnly && (
        <>
          <Button variant="outline" size="icon" className="size-9" aria-label="New project" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>You can add stages and flats after it is created.</DialogDescription>
              </DialogHeader>
              <NewProjectForm orgId={orgId} onCancel={() => setOpen(false)}
                onCreated={(id) => { setOpen(false); onCreated(id) }} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
