'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SLOTS = [
  { kind: 'site_plan', label: 'Site plan', hint: 'The floor plan of this flat' },
  { kind: 'agreement', label: 'Agreement', hint: 'The signed agreement' },
]

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
    if (upErr) { setError(upErr.message); setBusy(false); return }

    const { error: dbErr } = await supabase.from('documents').insert({
      flat_id: flatId, kind: slot.kind, file_name: file.name, storage_path: path,
    })
    if (dbErr) {
      await supabase.storage.from('documents').remove([path])
      setError(dbErr.message); setBusy(false); return
    }

    // The new file is saved, so it is now safe to remove the old one(s).
    if (docs.length) {
      await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
      await supabase.from('documents').delete().in('id', docs.map((d) => d.id))
    }
    if (inputRef.current) inputRef.current.value = ''
    setBusy(false)
    onChange()
  }

  async function remove() {
    if (!confirm(`Delete the ${slot.label.toLowerCase()}?`)) return
    setBusy(true)
    await supabase.storage.from('documents').remove(docs.map((d) => d.storage_path))
    await supabase.from('documents').delete().in('id', docs.map((d) => d.id))
    setBusy(false)
    onChange()
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium">{slot.label}</p>
          <p className="text-xs text-slate-500">{slot.hint}</p>
        </div>
        {current
          ? <span className="badge badge-green shrink-0">Uploaded</span>
          : <span className="badge badge-gray shrink-0">Not uploaded</span>}
      </div>

      <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />

      {current ? (
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <a href={urls[current.storage_path]} target="_blank" rel="noreferrer"
            className="text-sm text-brand-700 font-medium underline truncate block">
            {current.file_name}
          </a>
          <div className="flex gap-2 shrink-0">
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="btn !py-1.5 disabled:opacity-50">Replace</button>
            <button type="button" disabled={busy} onClick={remove}
              className="btn !py-1.5 !text-red-600 !border-red-200 hover:!bg-red-50 disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={`border-2 border-dashed rounded-xl py-6 text-center transition ${
            drag ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="btn-primary disabled:opacity-50">Choose file</button>
          <p className="text-xs text-slate-500 mt-2">or drag a PDF / image here · max 20 MB</p>
        </div>
      )}

      {busy && <p className="text-sm text-slate-500 mt-2">Working…</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
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
    <section className="card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Documents</h2>
        <p className="text-xs text-slate-500">
          Files upload as soon as you choose them, and the customer sees them on their portal.
        </p>
      </div>
      {SLOTS.map((slot) => (
        <Slot key={slot.kind} flatId={flatId} slot={slot}
          docs={docs.filter((d) => d.kind === slot.kind)} urls={urls} onChange={load} />
      ))}
    </section>
  )
}