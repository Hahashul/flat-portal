import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const LIFT =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.22)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'

export default function Section({ title, sub, action, flush, stackAction, className, children }) {
  return (
    <Card className={cn('gap-0 p-0', LIFT, className)}>
      <div className={cn('flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6', stackAction && 'flex-col sm:flex-row')}>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? 'mt-4' : 'mt-4 px-5 pb-5 sm:px-6 sm:pb-6'}>{children}</div>
    </Card>
  )
}