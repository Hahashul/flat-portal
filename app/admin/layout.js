'use client'
import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { LayoutDashboard, Building2, Plus, Layers, FolderOpen, LogOut, Search, Sun, Moon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail,
} from '@/components/ui/sidebar'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const links = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/flats', label: 'Flats', icon: Building2 },
  { href: '/admin/flats/new', label: 'Add flat', icon: Plus },
  { href: '/admin/files', label: 'Files', icon: FolderOpen },
  { href: '/admin/stages', label: 'Stages', icon: Layers },
]

function isActive(l, pathname) {
  if (l.href === '/admin') return pathname === '/admin'
  if (l.href === '/admin/flats') return pathname.startsWith('/admin/flats') && pathname !== '/admin/flats/new'
  return pathname === l.href
}

function crumbs(pathname, driveTrail = []) {
  const p = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (p[0] === 'stages') return [{ label: 'Stages' }]
  if (p[0] === 'files') {
    if (!driveTrail.length) return [{ label: 'Files' }]
    return [
      { label: 'Files', href: '/admin/files' },
      ...driveTrail.map((t, i) => ({
        label: t.name,
        href: i < driveTrail.length - 1 ? `/admin/files?f=${t.id}` : undefined,
      })),
    ]
  }
  if (p[0] === 'flats') {
    if (!p[1]) return [{ label: 'Flats' }]
    const out = [{ label: 'Flats', href: '/admin/flats' }]
    if (p[1] === 'new') out.push({ label: 'Add flat' })
    else if (p[2] === 'edit') {
      out.push({ label: 'Flat', href: `/admin/flats/${p[1]}` }, { label: 'Edit' })
    } else out.push({ label: 'Flat details' })
    return out
  }
  return [{ label: 'Home' }]
}

// Expanded: 44px rows. Collapsed: 48px square buttons with 24px icons, centred.
const NAV_BTN =
  'h-11 gap-3 text-[15px] [&>svg]:size-5 ' +
  'group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center ' +
  'group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:size-6 ' +
  'group-data-[collapsible=icon]:[&>span]:hidden'

function Logo() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-base font-bold text-white">F</span>
  )
}

/* Light / Dark switch: segmented like Basic due / With charges.
   Collapsed sidebar shows a single icon button instead. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <>
      <Tabs value={dark ? 'dark' : 'light'} onValueChange={setTheme} className="group-data-[collapsible=icon]:hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="light"><Sun className="size-4" />Light</TabsTrigger>
          <TabsTrigger value="dark"><Moon className="size-4" />Dark</TabsTrigger>
        </TabsList>
      </Tabs>
      <SidebarMenuButton
        tooltip={dark ? 'Switch to light' : 'Switch to dark'}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className={`hidden group-data-[collapsible=icon]:flex ${NAV_BTN}`}
      >
        {dark ? <Sun /> : <Moon />}<span>{dark ? 'Light mode' : 'Dark mode'}</span>
      </SidebarMenuButton>
    </>
  )
}

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [sbOpen, setSbOpen] = useState(true)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [flats, setFlats] = useState([])
  const [driveTrail, setDriveTrail] = useState([]) // folder path, sent by the Files page

  useEffect(() => {
    try { setSbOpen(localStorage.getItem('sb') !== '0') } catch {}
  }, [])
  function changeSb(v) {
    setSbOpen(v)
    try { localStorage.setItem('sb', v ? '1' : '0') } catch {}
  }

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut()
        return router.replace('/login')
      }
      setEmail(session.user.email)
      setReady(true)
    }
    check()
  }, [router])

  useEffect(() => {
    const h = (e) => setDriveTrail(e.detail || [])
    window.addEventListener('files-trail', h)
    return () => window.removeEventListener('files-trail', h)
  }, [])

  // Ctrl+K / Cmd+K opens search
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (!cmdOpen || !ready) return
    supabase.from('flats').select('id, flat_no, holder_name, status, wings(name)')
      .then(({ data }) => {
        const list = (data || []).sort((a, b) =>
          (a.wings?.name || '').localeCompare(b.wings?.name || '') ||
          a.flat_no.localeCompare(b.flat_no, undefined, { numeric: true }))
        setFlats(list)
      })
  }, [cmdOpen, ready])

  function go(href) {
    setCmdOpen(false)
    router.push(href)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-3xl" />
      </div>
    )
  }

  const trail = crumbs(pathname, driveTrail)

  return (
    <TooltipProvider>
      {/* Ctrl+B still collapses the sidebar (built into SidebarProvider) */}
      <SidebarProvider open={sbOpen} onOpenChange={changeSb} style={{ '--sidebar-width-icon': '4.5rem' }}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-14 justify-center border-b">
            <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Logo />
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">Flat Portal</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="p-3">
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {links.map((l) => (
                    <SidebarMenuItem key={l.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(l, pathname)}
                        tooltip={l.label}
                        className={NAV_BTN}
                      >
                        <Link href={l.href}><l.icon /><span>{l.label}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="gap-3 p-3">
            <ThemeToggle />
            <SidebarMenu>
              <SidebarMenuItem>
                <p className="truncate px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{email}</p>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sign out" onClick={logout} className={NAV_BTN}>
                  <LogOut /><span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          {/* No button: click the sidebar's right edge (or press Ctrl+B) to collapse */}
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-4 sm:px-6 md:px-8">
            {/* Desktop: breadcrumbs */}
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                {trail.map((c, i) => (
                  <Fragment key={(c.href || c.label) + i}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {i === trail.length - 1 || !c.href
                        ? <BreadcrumbPage>{c.label}</BreadcrumbPage>
                        : <BreadcrumbLink asChild><Link href={c.href}>{c.label}</Link></BreadcrumbLink>}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Phone: brand */}
            <span className="flex items-center gap-2 font-semibold md:hidden"><Logo />Flat Portal</span>

            {/* Search */}
            <Button variant="outline" onClick={() => setCmdOpen(true)}
              className="ml-auto hidden w-64 justify-start gap-2 font-normal text-muted-foreground md:flex">
              <Search className="size-4" /> Search flats…
              <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">Ctrl K</kbd>
            </Button>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Search"
              onClick={() => setCmdOpen(true)}>
              <Search className="size-5" />
            </Button>

            {/* Phone: account menu (includes dark mode) */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account" className="rounded-full">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                        {(email[0] || 'A').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                    {resolvedTheme === 'dark' ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                    {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}><LogOut className="mr-2 size-4" /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:p-8 md:pb-8">{children}</div>

          {/* Phone: bottom tab bar */}
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive(l, pathname) ? 'text-teal-600' : 'text-muted-foreground'
                }`}>
                <l.icon className="size-5" />
                {l.label}
              </Link>
            ))}
          </nav>
        </SidebarInset>
      </SidebarProvider>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}
        title="Search" description="Find a flat or jump to a page">
        <CommandInput placeholder="Type a flat number or a name…" />
        <CommandList>
          <CommandEmpty>No flat found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {links.map((l) => (
              <CommandItem key={l.href} value={`go ${l.label}`} onSelect={() => go(l.href)}>
                <l.icon /> {l.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Flats">
            {flats.map((f) => (
              <CommandItem key={f.id} value={`${f.wings?.name}-${f.flat_no} ${f.holder_name || ''}`}
                onSelect={() => go(`/admin/flats/${f.id}`)}>
                <Building2 />
                <span className="font-medium">{f.wings?.name}-{f.flat_no}</span>
                <span className="truncate text-muted-foreground">{f.holder_name || 'No holder'}</span>
                {f.status && <span className="ml-auto text-xs text-muted-foreground">{f.status}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}