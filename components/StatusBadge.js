import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STYLE = {
  Sold: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  Tenant: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  Owner: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  'For Sale': 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'No status': 'bg-muted text-muted-foreground',
}

export default function StatusBadge({ value }) {
  const s = value || 'No status'
  return (
    <Badge variant="secondary" className={cn('border-0 font-medium', STYLE[s] || STYLE['No status'])}>
      {s}
    </Badge>
  )
}