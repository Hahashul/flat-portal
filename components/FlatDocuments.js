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
    <div className="border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium">{slot.label}</p>
          <p className="text-xs text-gray-500">{slot.hint}</p>
        </div>
        {current ? (
          <span className="text-xs bg-green-100 text-green-800 rounded-full px-2.5 py-1">Uploaded</span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">Not uploaded</span>
        )}
      </div>

      <input
        ref={inputRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {current ? (
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
          <a href={urls[current.storage_path]} target="_blank" rel="noreferrer"
            className="underline truncate">
            {current.file_name}
          </a>
          <div className="flex gap-2 shrink-0">
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="border rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-100 disabled:opacity-50">
              Replace
            </button>
            <button type="button" disabled={busy} onClick={remove}
              className="border border-red-200 text-red-600 rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-red-50 disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={`border-2 border-dashed rounded-lg py-6 text-center transition ${
            drag ? 'border-black bg-gray-100' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="bg-black text-white rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50">
            Choose file
          </button>
          <p className="text-xs text-gray-500 mt-2">or drag a PDF / image here · max 20 MB</p>
        </div>
      )}

      {busy && <p className="text-sm text-gray-500 mt-2">Working…</p>}
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
    <section className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <h2 className="font-medium">Documents</h2>
        <p className="text-xs text-gray-500">
          Files upload as soon as you choose them, and the customer sees them on their portal.
        </p>
      </div>
      {SLOTS.map((slot) => (
        <Slot
          key={slot.kind} flatId={flatId} slot={slot}
          docs={docs.filter((d) => d.kind === slot.kind)}
          urls={urls} onChange={load}
        />
      ))}
    </section>
  )
}