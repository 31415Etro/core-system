import type React from "react"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, Inbox, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/core/glass-card"
import { cn } from "@/lib/utils"

export { Skeleton }

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-xl border border-border bg-white/[0.04] text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.04] px-6 py-8 text-center", className)}>
      <AlertTriangle className="size-5 text-red-400" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Tentar novamente
        </Button>
      )}
    </div>
  )
}

/* Presets de skeleton para os padrões mais comuns */
export function MetricSkeleton() {
  return (
    <GlassCard className="min-h-[124px] space-y-4 p-5">
      <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><Skeleton className="h-4 w-24" /></div>
      <Skeleton className="h-7 w-32" />
    </GlassCard>
  )
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" /></div></div>
      <Skeleton style={{ height }} className="w-full rounded-xl" />
    </GlassCard>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
}
