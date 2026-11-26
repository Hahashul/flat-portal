'use client'
import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, Plus, Layers, FolderOpen, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import Shell from '@/components/Shell'
import ProjectSwitcher, { NewProjectForm } from '@/components/ProjectSwitcher'
import { Card } from '@/components/ui/card'
import { WorkspaceContext } from '@/lib/workspace'

const links = [
  { href: '/app', label: 'Home', icon: LayoutDashboard },
  { href: '/app/flats', label: 'Flats', icon: Building2, active: (p) => p.startsWith('/app/flats') && p !== '/app/flats/new' },
  { href: '/app/flats/new', label: 'Add flat', icon: Plus },
  { href: '/app/files', label: 'Files', icon: FolderOpen },
  { href: '/app/stages', label: 'Stages', icon: Layers },
]

function crumbs(pathname, driveTrail = []) {
  const p = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean)
  if (p[0] === 'stages') return [{ label: 'Stages' }]
  if (p[0] === 'files') {
    if (!driveTrail.length) return [{ label: 'Files' }]
    return [
      { label: 'Files', href: '/app/files' },
      ...driveTrail.map((t, i) => ({
        label: t.name,
        href: i < driveTrail.length - 1 ? `/app/files?f=${t.id}` : undefined,
      })),
    ]
  }
  if (p[0] === 'flats') {
    if (!p[1]) return [{ label: 'Flats' }]
    const out = [{ label: 'Flats', href: '/app/flats' }]
    if (p[1] === 'new') out.push({ label: 'Add flat' })
    else if (p[2] === 'edit') {
      out.push({ label: 'Flat', href: `/app/flats/${p[1]}` }, { label: 'Edit' })
    } else out.push({ label: 'Flat details' })
    return out
  }
  return [{ label: 'Home' }]
}

export default function WorkspaceLayout({ children }) {
  const router = useRouter()
  const [ws, setWs] = useState(null)
  const [email, setEmail] = useState('')
  const [projects, setProjects] = useState(null)
  const [projectId, setProjectId] = useState(null)

  const loadProjects = useCallback(async (orgId, pick) => {
    const { data } = await supabase.from('projects').select('id, name').eq('org_id', orgId).order('name')
    const list = data || []
    let saved = null
    try { saved = localStorage.getItem(`project:${orgId}`) } catch {}
    const chosen = list.find((p) => p.id === pick) || list.find((p) => p.id === saved) || list[0] || null
    if (chosen) { try { localStorage.setItem(`project:${orgId}`, chosen.id) } catch {} }
    setProjects(list)
    setProjectId(chosen ? chosen.id : null)
  }, [])
  useEffect(() => { if (ws) loadProjects(ws.orgId) }, [ws, loadProjects])

  function chooseProject(id) {
    try { localStorage.setItem(`project:${ws.orgId}`, id) } catch {}
    setProjectId(id)
    router.push('/app')
  }

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      const { data: profile } = await supabase
        .from('profiles').select('role, org_id, disabled').eq('id', session.user.id).single()
      const role = profile?.role
      if (!profile || profile.disabled || !['admin', 'customer', 'demo'].includes(role)) {
        await supabase.auth.signOut()
        return router.replace('/login')
      }

      // Admin picks an organization with ?org=<id> (remembered for this tab).
      // This only chooses what to show. The database decides what is allowed.
      let orgId = profile.org_id
      if (role === 'admin') {
        const q = new URLSearchParams(window.location.search).get('org')
        try {
          if (q) sessionStorage.setItem('viewOrg', q)
          orgId = q || sessionStorage.getItem('viewOrg')
        } catch { orgId = q }
        if (!orgId) return router.replace('/admin/customers')
      }
      if (!orgId) {
        await supabase.auth.signOut()
        return router.replace('/login')
      }

      const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
      if (!org) {
        if (role === 'admin') return router.replace('/admin/customers')
        await supabase.auth.signOut()
        return router.replace('/login')
      }
      setEmail(session.user.email)
      setWs({ role, orgId, orgName: org.name, readOnly: role === 'demo', adminView: role === 'admin' })
    }
    check()
  }, [router])

  async function logout() {
    try { sessionStorage.removeItem('viewOrg') } catch {}
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ws || !projects) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-3xl" />
      </div>
    )
  }

  const bar = 'flex items-center gap-3 border-b bg-muted px-4 py-2 text-sm sm:px-6 md:px-8'
  const banner = ws.adminView ? (
    <div className={bar}>
      <span>Viewing <span className="font-medium">{ws.orgName}</span> as admin</span>
      <Link
        href="/admin/customers"
        onClick={() => { try { sessionStorage.removeItem('viewOrg') } catch {} }}
        className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to Customers
      </Link>
    </div>
  ) : ws.readOnly ? (
    <div className={bar}>Demo, read only. Changes are turned off.</div>
  ) : null

  return (
    <WorkspaceContext.Provider value={{ ...ws, projects, projectId }}>
      <Shell
        links={ws.readOnly ? links.filter((l) => l.href !== '/app/flats/new') : links}
        crumbs={crumbs}
        brand={ws.orgName}
        email={email}
        onLogout={logout}
        banner={banner}
        orgId={ws.orgId}
        headerExtra={projects.length > 0 && (
          <ProjectSwitcher
            projects={projects} projectId={projectId} onChange={chooseProject}
            orgId={ws.orgId} readOnly={ws.readOnly}
            onCreated={(id) => { loadProjects(ws.orgId, id); router.push('/app') }}
          />
        )}
        searchable
      >
        {projects.length === 0 ? (
          <Card className="mx-auto mt-8 max-w-md gap-4 p-6">
            <div>
              <h2 className="text-base font-semibold">{ws.readOnly ? 'No projects yet' : 'Create your first project'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ws.readOnly ? 'This demo has no data yet.' : 'A project holds your wings, stages and flats.'}
              </p>
            </div>
            {!ws.readOnly && (
              <NewProjectForm orgId={ws.orgId} onCreated={(id) => loadProjects(ws.orgId, id)} />
            )}
          </Card>
        ) : (
          <Fragment key={projectId}>{children}</Fragment>
        )}
      </Shell>
    </WorkspaceContext.Provider>
  )
}
