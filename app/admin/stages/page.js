'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function Row({ r, i, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }
  return (
    <li ref={setNodeRef} style={style}
      className={`flex items-center gap-2 py-2.5 bg-white ${isDragging ? 'shadow-lg rounded-xl' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder"
        className="touch-none cursor-grab active:cursor-grabbing text-slate-400 px-1.5 py-1 text-lg leading-none">⋮⋮</button>
      <span className="w-6 text-sm text-slate-400">{i + 1}</span>
      <input defaultValue={r.name} onBlur={(e) => onRename(r, e.target.value)}
        className="flex-1 min-w-0 border border-transparent hover:border-slate-300 focus:border-slate-300 rounded-lg px-2 py-1.5 bg-transparent" />
      <button className="text-xs text-red-600 px-1" onClick={() => onDelete(r)}>Delete</button>
    </li>
  )
}

export default function Stages() {
  const [rows, setRows] = useState([])
  const [projectId, setProjectId] = useState(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function load() {
    const { data } = await supabase.from('stages')
      .select('id, name, position, project_id').order('position')
    setRows(data || [])
    if (data?.[0]) setProjectId(data[0].project_id)
    else {
      const { data: p } = await supabase.from('projects').select('id').limit(1).single()
      setProjectId(p?.id)
    }
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    const pos = (rows.at(-1)?.position || 0) + 1
    const { error } = await supabase.from('stages')
      .insert({ project_id: projectId, name: name.trim(), position: pos })
    if (error) return setMsg(error.message)
    setName(''); setMsg(''); load()
  }

  async function rename(r, v) {
    if (!v.trim() || v.trim() === r.name) return
    await supabase.from('stages').update({ name: v.trim() }).eq('id', r.id)
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
    if (results.some((r) => r.error)) setMsg('Could not save the new order.')
    load()
  }

  async function del(r) {
    if (!confirm(`Delete the stage "${r.name}"?`)) return
    const { error } = await supabase.from('stages').delete().eq('id', r.id)
    if (error) {
      return setMsg(error.code === '23503'
        ? 'Some flats still use this stage. Remove it from their installments first.'
        : error.message)
    }
    setMsg(''); load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stages</h1>
        <p className="text-sm text-slate-500 mt-1">
          Drag ⋮⋮ to reorder. A wing at a stage has reached every stage above it.
        </p>
      </div>

      <section className="card p-5 sm:p-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-slate-100">
              {rows.map((r, i) => <Row key={r.id} r={r} i={i} onRename={rename} onDelete={del} />)}
            </ul>
          </SortableContext>
        </DndContext>
        {msg && <p className="text-sm text-red-600 mt-3">{msg}</p>}
      </section>

      <form onSubmit={add} className="card p-5 sm:p-6 flex gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New stage name"
          className="flex-1 min-w-0 border border-slate-300 rounded-xl px-3 py-2.5 bg-white" />
        <button disabled={!name.trim()} className="btn-primary">Add stage</button>
      </form>
    </div>
  )
}