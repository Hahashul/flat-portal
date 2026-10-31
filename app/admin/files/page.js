import { Suspense } from 'react'
import FilesView from '@/components/FilesView'
import { FilesSkeleton } from '@/components/skeletons'

export default function FilesPage() {
  return (
    <Suspense fallback={<FilesSkeleton />}>
      <FilesView />
    </Suspense>
  )
}