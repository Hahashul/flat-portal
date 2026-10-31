'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronRight, Download, EllipsisVertical, ExternalLink, File as FileIcon, FileImage,
  FileSpreadsheet, FileText, Folder, FolderOpen, FolderPlus, LayoutGrid, List, Pencil,
  Loader2, Search, Trash2, Upload, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { LIFT } from '@/components/Section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FilesSkeleton } from '@/components/skeletons'

/*
  Rules used on this page
  - Header: title (current folder) left, actions right. Muted line = the path above this folder.
  - Solid teal = the one main action (Upload). New folder is soft teal.
  - Every folder and file is its own soft card with the lift hover. List = rows, Grid = tiles.
  - Folders first, then files, both A to Z.
  - Everything is private. Files open through links that expire after one hour.
*/

const SOFT = 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
const BUCKET = 'drive'
const MAX = 20 * 1024 * 1024
const ALLOWED = [
  'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx',
]
const ACCEPT = ALLOWED.map((e) => `.${e}`).join(',')
const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic']
const SHEETS = ['xls', 'xlsx', 'csv']
const VIEW_IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif']

const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
const fmtSize = (b) => {
  if (!b) return '0 KB'
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
function iconFor(item) {
  if (item.kind === 'folder') return Folder
  const e = ext(item.name)
  if (IMAGES.includes(e)) return FileImage
  if (SHEETS.includes(e)) return FileSpreadsheet
  if (e === 'pdf' || e === 'doc' || e === 'docx' || e === 'txt') return FileText
  return FileIcon
}

function ItemCard({ item, view, meta, where, onOpen, onRename, onDownload, onDelete }) {
  const Icon = iconFor(item)
  const isFile = item.kind === 'file'

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label={`Actions for ${item.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* Portal events bubble to the card in React, so stop them here */}
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onOpen}>
          {isFile ? <ExternalLink className="mr-2 size-4" /> : <FolderOpen className="mr-2 size-4" />}
          Open
        </DropdownMenuItem>
        {isFile && (
          <DropdownMenuItem onClick={onDownload}>
            <Download className="mr-2 size-4" /> Download
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="mr-2 size-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 size-4 text-destructive" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const press = (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onOpen()
    }
  }

  if (view === 'grid') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={press}
        className={cn(
          'flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          LIFT
        )}
      >
        <div className="flex items-start justify-between">
          <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <span className="-mr-1 -mt-1">{menu}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{where ? `${where} · ${meta}` : meta}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={press}
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-xl border bg-card px-5 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        LIFT
      )}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{where ? `${where} · ${meta}` : meta}</p>
      </div>
      {menu}
    </div>
  )
}

export default function FilesView() {
  const router = useRouter()
  const params = useSearchParams()
  const folderId = params.get('f') || null

  const [items, setItems] = useState(null)
  const [tick, setTick] = useState(0)
  const [view, setView] = useState('list')
  const [q, setQ] = useState('')
  const [naming, setNaming] = useState(null) // { mode: 'new' | 'rename', item?, value }
  const [saving, setSaving] = useState(false)
  const [del, setDel] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [viewer, setViewer] = useState(null) // { item, url, kind }
  const dragN = useRef(0)
  const fileRef = useRef(null)

  useEffect(() => {
    try { setView(localStorage.getItem('filesView') === 'grid' ? 'grid' : 'list') } catch {}
  }, [])
  function changeView(v) {
    setView(v)
    try { localStorage.setItem('filesView', v) } catch {}
  }

  useEffect(() => {
    let off = false
    supabase.from('drive_items').select('*').order('name').then(({ data, error }) => {
      if (off) return
      if (error) toast.error(error.message)
      setItems(data || [])
    })
    return () => { off = true }
  }, [tick])

  const byId = useMemo(() => new Map((items || []).map((i) => [i.id, i])), [items])
  const current = folderId ? byId.get(folderId) : null

  const trail = useMemo(() => {
    const out = []
    let c = current
    while (c) {
      out.unshift(c)
      c = c.parent_id ? byId.get(c.parent_id) : null
    }
    return out
  }, [current, byId])

  // Tell the top bar (app/admin/layout.js) where we are, so it can show the full path
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('files-trail', {
      detail: trail.map((t) => ({ id: t.id, name: t.name })),
    }))
  }, [trail])
  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent('files-trail', { detail: [] }))
  }, [])

  useEffect(() => {
    if (!viewer) return
    const h = (e) => { if (e.key === 'Escape') setViewer(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [viewer])

  const counts = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach((i) => { if (i.parent_id) m.set(i.parent_id, (m.get(i.parent_id) || 0) + 1) })
    return m
  }, [items])

  const term = q.trim().toLowerCase()
  const list = useMemo(() => {
    if (!items) return []
    const base = term
      ? items.filter((i) => i.name.toLowerCase().includes(term))
      : items.filter((i) => (i.parent_id || null) === folderId)
    return [...base].sort((a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [items, term, folderId])

  function whereOf(item) {
    const names = []
    let c = item.parent_id ? byId.get(item.parent_id) : null
    while (c) {
      names.unshift(c.name)
      c = c.parent_id ? byId.get(c.parent_id) : null
    }
    return ['Files', ...names].join(' / ')
  }

  function go(id) {
    setQ('')
    router.push(id ? `/admin/files?f=${id}` : '/admin/files')
  }

  // Images and PDFs open inside the app. Other types (Word, Excel...) download.
  // Phones cannot show PDFs inline reliably, so PDFs use the phone's own viewer.
  async function openFile(item) {
    const e = ext(item.name)
    const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const kind = VIEW_IMAGES.includes(e) ? 'image' : e === 'pdf' && !phone ? 'pdf' : null
    if (!kind) return downloadFile(item)
    setViewer({ item, url: null, kind })
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 3600)
    if (error || !data) {
      setViewer(null)
      return toast.error(error?.message || 'Could not open the file')
    }
    setViewer((v) => (v && v.item.id === item.id ? { ...v, url: data.signedUrl } : v))
  }

  async function downloadFile(item) {
    const { data, error } = await supabase.storage
      .from(BUCKET).createSignedUrl(item.storage_path, 3600, { download: item.name })
    if (error || !data) return toast.error(error?.message || 'Could not download the file')
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = item.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const openItem = (item) => (item.kind === 'folder' ? go(item.id) : openFile(item))

  async function upload(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const good = []
    for (const f of files) {
      if (!ALLOWED.includes(ext(f.name))) { toast.error(`${f.name}: this file type is not supported`); continue }
      if (f.size > MAX) { toast.error(`${f.name} is too large (maximum 20 MB)`); continue }
      good.push(f)
    }
    if (!good.length) return

    const tid = toast.loading(`Uploading 1 of ${good.length}…`)
    let ok = 0
    for (let i = 0; i < good.length; i++) {
      const f = good[i]
      toast.loading(`Uploading ${i + 1} of ${good.length}…`, { id: tid })
      const id = crypto.randomUUID()
      const path = `${id}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(path, f, { contentType: f.type || undefined })
      if (upErr) { toast.error(`${f.name}: ${upErr.message}`); continue }
      const { error: dbErr } = await supabase.from('drive_items').insert({
        id, kind: 'file', name: f.name, parent_id: folderId, storage_path: path,
        size: f.size, mime_type: f.type || null,
      })
      if (dbErr) {
        await supabase.storage.from(BUCKET).remove([path])
        toast.error(`${f.name}: ${dbErr.message}`)
        continue
      }
      ok++
    }
    if (ok) toast.success(ok === 1 ? '1 file uploaded' : `${ok} files uploaded`, { id: tid })
    else toast.dismiss(tid)
    setTick((t) => t + 1)
  }

  async function submitName(e) {
    e.preventDefault()
    const name = (naming.value || '').trim()
    if (!name) return
    if (/[\\/]/.test(name)) return toast.error('A name cannot contain / or \\')
    const isRename = naming.mode === 'rename'
    const kind = isRename ? naming.item.kind : 'folder'
    const parent = isRename ? naming.item.parent_id || null : folderId
    if (kind === 'folder') {
      const clash = (items || []).some((i) =>
        i.kind === 'folder' && (i.parent_id || null) === parent &&
        i.name.toLowerCase() === name.toLowerCase() && (!isRename || i.id !== naming.item.id))
      if (clash) return toast.error('A folder with that name already exists here.')
    }
    setSaving(true)
    const { error } = isRename
      ? await supabase.from('drive_items').update({ name }).eq('id', naming.item.id)
      : await supabase.from('drive_items').insert({ kind: 'folder', name, parent_id: folderId })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(isRename ? 'Renamed' : 'Folder created')
    setNaming(null)
    setTick((t) => t + 1)
  }

  function inside(id) {
    const out = []
    const stack = [id]
    while (stack.length) {
      const p = stack.pop()
      for (const i of items) {
        if (i.parent_id === p) {
          out.push(i)
          if (i.kind === 'folder') stack.push(i.id)
        }
      }
    }
    return out
  }

  async function confirmDelete() {
    const it = del
    const all = it.kind === 'folder' ? [it, ...inside(it.id)] : [it]
    const paths = all.filter((x) => x.kind === 'file').map((x) => x.storage_path)
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (error) return toast.error(error.message)
    }
    const { error } = await supabase.from('drive_items').delete().eq('id', it.id)
    if (error) return toast.error(error.message)
    toast.success(it.kind === 'folder' ? 'Folder deleted' : 'File deleted')
    setTick((t) => t + 1)
  }

  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
  const dropProps = {
    onDragEnter: (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragN.current += 1
      setDragging(true)
    },
    onDragOver: (e) => { if (hasFiles(e)) e.preventDefault() },
    onDragLeave: (e) => {
      if (!hasFiles(e)) return
      dragN.current = Math.max(0, dragN.current - 1)
      if (dragN.current === 0) setDragging(false)
    },
    onDrop: (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragN.current = 0
      setDragging(false)
      upload(e.dataTransfer.files)
    },
  }

  if (!items) return <FilesSkeleton />

  if (folderId && !current) {
    return (
      <div className="mx-auto max-w-7xl py-16 text-center">
        <p className="font-medium">Folder not found</p>
        <Button variant="ghost" className="mt-3" onClick={() => go(null)}>Back to Files</Button>
      </div>
    )
  }

  const parents = [{ id: null, name: 'Files' }, ...trail.slice(0, -1)]
  const delCount = del?.kind === 'folder' ? inside(del.id).length : 0

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col gap-4" {...dropProps}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{current ? current.name : 'Files'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {current ? (
              <>
                {/* Desktop: the top bar shows the path */}
                <span className="hidden md:inline">
                  {counts.get(current.id) || 0} {counts.get(current.id) === 1 ? 'item' : 'items'}
                </span>
                {/* Phone: no breadcrumbs in the top bar, so show the path here */}
                <span className="flex flex-wrap items-center gap-1 md:hidden">
                  {parents.map((p, i) => (
                    <span key={p.id || 'root'} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="size-3.5" />}
                      <button
                        type="button"
                        onClick={() => go(p.id)}
                        className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
                      >
                        {p.name}
                      </button>
                    </span>
                  ))}
                </span>
              </>
            ) : (
              'Private storage for your documents'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className={SOFT} onClick={() => setNaming({ mode: 'new', value: '' })}>
            <FolderPlus className="size-4" />
            New folder
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { upload(e.target.files); e.target.value = '' }}
          />
        </div>
      </div>

      {/* Search and view */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all files and folders…"
            aria-label="Search files"
            className="pl-9"
          />
        </div>
        <Tabs value={view} onValueChange={changeView}>
          <TabsList>
            <TabsTrigger value="list" aria-label="List view"><List className="size-4" /><span className="hidden sm:inline">List</span></TabsTrigger>
            <TabsTrigger value="grid" aria-label="Grid view"><LayoutGrid className="size-4" /><span className="hidden sm:inline">Grid</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Items */}
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
          {term
            ? 'No files or folders match your search.'
            : 'This folder is empty. Upload files, drag them here, or create a folder.'}
        </p>
      ) : (
        <div
          className={
            view === 'grid'
              ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4'
              : 'flex flex-col gap-3'
          }
        >
          {list.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              view={view}
              where={term ? whereOf(item) : ''}
              meta={
                item.kind === 'folder'
                  ? `${counts.get(item.id) || 0} ${counts.get(item.id) === 1 ? 'item' : 'items'}`
                  : `${fmtSize(item.size)} · ${fmtDate(item.created_at)}`
              }
              onOpen={() => openItem(item)}
              onDownload={() => downloadFile(item)}
              onRename={() => setNaming({ mode: 'rename', item, value: item.name })}
              onDelete={() => setDel(item)}
            />
          ))}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/80">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Upload className="size-5" />
            Drop files to upload to {current ? current.name : 'Files'}
          </p>
        </div>
      )}

      {/* In-app viewer */}
      {viewer && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={viewer.item.name}>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{viewer.item.name}</p>
            <Button size="sm" variant="ghost" className={SOFT} onClick={() => downloadFile(viewer.item)}>
              <Download className="size-4" />
              Download
            </Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Close" onClick={() => setViewer(null)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 bg-muted/40">
            {!viewer.url ? (
              <div className="grid h-full place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewer.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.url} alt={viewer.item.name} className="mx-auto h-full max-w-full object-contain p-4" />
            ) : (
              <iframe src={viewer.url} title={viewer.item.name} className="size-full border-0" />
            )}
          </div>
        </div>
      )}

      {/* New folder / Rename */}
      <Sheet open={!!naming} onOpenChange={(o) => !o && setNaming(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 sm:px-6">
            <SheetTitle>{naming?.mode === 'rename' ? 'Rename' : 'New folder'}</SheetTitle>
            <SheetDescription>
              {naming?.mode === 'rename'
                ? naming.item.name
                : `Inside ${current ? current.name : 'Files'}`}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submitName} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-2 px-5 py-5 sm:px-6">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                autoFocus
                value={naming?.value ?? ''}
                onChange={(e) => setNaming((n) => ({ ...n, value: e.target.value }))}
              />
            </div>
            <SheetFooter className="border-t px-5 py-4 sm:px-6">
              <Button type="submit" disabled={saving || !(naming?.value || '').trim()}>
                {saving ? 'Saving…' : naming?.mode === 'rename' ? 'Save' : 'Create folder'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setNaming(null)}>Cancel</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete */}
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {del?.kind === 'folder' ? 'this folder' : 'this file'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {del?.kind === 'folder'
                ? `"${del.name}" and ${delCount} ${delCount === 1 ? 'item' : 'items'} inside it will be permanently deleted. This cannot be undone.`
                : `"${del?.name}" will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}