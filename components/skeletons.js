import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/* Same padding as the real cards, so nothing shifts when data arrives. */
const PAD = 'gap-0 px-5 py-5 sm:px-6 sm:py-6'

export function CardHeadSkeleton() {
  return (
    <div>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-4 w-52" />
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <Card className={PAD}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-2 h-7 w-32 sm:h-8 lg:h-9" />
      <Skeleton className="mt-2 h-4 w-28" />
    </Card>
  )
}

/* Rows for list cards. Phone shows 5, desktop shows `count`. */
export function ListRowsSkeleton({ count = 7 }) {
  return (
    <ul className="mt-4 divide-y border-t">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className={cn('items-center gap-3 px-5 py-3 sm:px-6', i >= 5 ? 'hidden lg:flex' : 'flex')}>
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40 max-w-full" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
        </li>
      ))}
    </ul>
  )
}

export function DonutCardSkeleton() {
  return (
    <Card className={PAD}>
      <CardHeadSkeleton />
      <div className="mt-4 flex items-center gap-6">
        <Skeleton className="size-32 shrink-0 rounded-full sm:size-36" />
        <ul className="min-w-0 flex-1 space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export function WingsCardSkeleton({ count = 2 }) {
  return (
    <Card className={PAD}>
      <CardHeadSkeleton />
      <div className="mt-4 divide-y">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-44 rounded-md" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* Whole dashboard. The title and toggle show at once; only data is skeleton. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <Tabs value="basic">
          <TabsList>
            <TabsTrigger value="basic" disabled>Basic due</TabsTrigger>
            <TabsTrigger value="charges" disabled>With charges</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="relative gap-0 p-0 lg:col-span-7 lg:min-h-[26rem]">
          <div className="flex flex-col py-5 sm:py-6 lg:absolute lg:inset-0">
            <div className="px-5 sm:px-6"><CardHeadSkeleton /></div>
            <ListRowsSkeleton />
          </div>
        </Card>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <DonutCardSkeleton />
          <WingsCardSkeleton />
        </div>
      </div>
    </div>
  )
}

/* Flats list: header, filters and rows match the real page. */
export function FlatsSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Flats</h1>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:w-40" />
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>
      <ul className="divide-y border-y">
        {Array.from({ length: 10 }).map((_, i) => (
          <li key={i} className={cn('h-11 items-center gap-6 px-1', i >= 5 ? 'hidden md:flex' : 'flex')}>
            <Skeleton className="h-4 w-48 max-w-[50%] flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* Card with a header and list rows (payments, installments, charges...). */
export function ListCardSkeleton({ rows = 4 }) {
  return (
    <Card className="gap-0 p-0">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6"><CardHeadSkeleton /></div>
      <ul className="mt-4 divide-y border-t">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex h-14 items-center gap-3 px-5 sm:px-6">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* Flat page: header, due card, then the two columns. */
export function FlatViewSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-full sm:w-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Card className={PAD}>
            <CardHeadSkeleton />
            <Skeleton className="mt-4 h-10 w-52" />
            <Skeleton className="mt-6 h-2 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </Card>
          <ListCardSkeleton rows={5} />
          <ListCardSkeleton rows={3} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <ListCardSkeleton rows={6} />
          <ListCardSkeleton rows={4} />
          <ListCardSkeleton rows={2} />
        </div>
      </div>
    </div>
  )
}

/* Add / Edit flat form */
function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

function FormCardSkeleton({ fields = 4 }) {
  return (
    <Card className={PAD}>
      <CardHeadSkeleton />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => <FieldSkeleton key={i} />)}
      </div>
    </Card>
  )
}

export function FormSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="hidden h-9 w-40 md:block" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <FormCardSkeleton fields={6} />
          <FormCardSkeleton fields={5} />
        </div>
        <div className="flex flex-col gap-4">
          <FormCardSkeleton fields={5} />
          <FormCardSkeleton fields={4} />
        </div>
      </div>
    </div>
  )
}

/* Stages page */
export function StagesSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stages</h1>
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7"><ListCardSkeleton rows={8} /></div>
        <div className="order-first flex flex-col gap-4 lg:order-none lg:col-span-5">
          <Card className={PAD}>
            <CardHeadSkeleton />
            <div className="mt-4 flex gap-3">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-24" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}