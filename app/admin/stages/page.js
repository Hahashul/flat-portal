'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import Section from '@/components/Section'
import { StagesSkeleton } from '@/components/skeletons'

/*
  Rules used on this page
  - Same layout as the other screens: wide list (7) + narrow side cards (5).
  - Rows run edge to edge with thin dividers and a grey hover. Teal only for Add stage.
  - Rename: click a name, type, press Enter or click away. Delete asks first.
*/

function Row({ r, i, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 bg-card px-5 py-2.5 transition-colors hover:bg-muted/60 sm:px-6',
        isDragging && 'relative z-10 rounded-lg shadow-lg'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${r.name} to reorder`}
        className="touch-none cursor-grab rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
      <Input
        key={r.id + r.name}
        defaultValue={r.name}
        aria-label={`Name of stage ${i + 1}`}
        onBlur={(e) => onRename(r, e.target)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-9 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring"
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${r.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the stage “{r.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This only works if no flat uses the stage in its installments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => onDelete(r)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export default function Stages() {
  const [rows, setRows] = useState([])
  const [projectId, setProjectId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(async () => {
    const { data } = await supabase.from('stages')
      .select('id, name, position, project_id').order('position')
    setRows(data || [])
    if (data?.[0]) setProjectId(data[0].project_id)
    else {
      const { data: p } = await supabase.from('projects').select('id').limit(1).single()
      setProjectId(p?.id)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setAdding(true)
    const pos = (rows.at(-1)?.position || 0) + 1
    const { error } = await supabase.from('stages').insert({ project_id: projectId, name: n, position: pos })
    setAdding(false)
    if (error) return toast.error(error.message)
    toast.success(`Stage “${n}” added`)
    setName('')
    load()
  }

  async function rename(r, input) {
    const v = input.value.trim()
    if (!v) { input.value = r.name; return }
    if (v === r.name) return
    const { error } = await supabase.from('stages').update({ name: v }).eq('id', r.id)
    if (error) { input.value = r.name; return toast.error(error.message) }
    toast.success('Stage renamed')
    load()
  }

  async function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = rows.findIndex((x) => x.id === active.id)
    const to = rows.findIndex((x) => x.id === over.id)
    const next = arrayMove(rows, from, to).map((x, i) => ({ ...x, position: i + 1 }))
    setRows(next)
    const changed = next.filter((x, i) => rows[i]?.id !== x.id)
    const results = await Promise.all(changed.map((x) =>
      supabase.from('stages').update({ position: x.position }).eq('id', x.id)))
    if (results.some((r) => r.error)) toast.error('Could not save the new order.')
    load()
  }

  async function del(r) {
    const { error } = await supabase.from('stages').delete().eq('id', r.id)
    if (error) {
      return toast.error(error.code === '23503'
        ? 'Some flats still use this stage. Remove it from their installments first.'
        : error.message)
    }
    toast.success(`Stage “${r.name}” deleted`)
    load()
  }

  if (loading) return <StagesSkeleton />

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The construction stages used by every wing and every flat’s installments
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        {/* Left (wide): the list */}
        <div className="lg:col-span-7">
          <Section
            flush
            title="All stages"
            sub={`${rows.length} ${rows.length === 1 ? 'stage' : 'stages'} · drag to reorder`}
          >
            {rows.length === 0 ? (
              <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
                No stages yet. Add the first one.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y border-t">
                    {rows.map((r, i) => <Row key={r.id} r={r} i={i} onRename={rename} onDelete={del} />)}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Section>
        </div>

        {/* Right (narrow). On phone, Add stage comes first. */}
        <div className="order-first flex flex-col gap-4 lg:order-none lg:col-span-5">
          <Section title="Add stage" sub="It goes to the end of the list">
            <form onSubmit={add} className="flex gap-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New stage name"
                aria-label="New stage name"
                className="h-9 min-w-0 flex-1"
              />
              <Button type="submit" disabled={adding || !name.trim()}>
                <Plus className="size-4" />
                {adding ? 'Adding…' : 'Add'}
              </Button>
            </form>
          </Section>

          <Section title="How it works" sub="Stages and wings">
            <p className="text-sm text-muted-foreground">
              A wing at a stage has reached every stage above it, so those installments are due.
              Reordering changes which stages count as reached.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}