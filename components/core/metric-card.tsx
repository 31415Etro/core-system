"use client"

import type React from "react"
import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard, IconTile } from "@/components/core/glass-card"
import { cn } from "@/lib/utils"

export type MetricMenuItem = { label: string; onSelect: () => void }

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  /** Variação percentual vs. período anterior. null/undefined = sem comparação. */
  delta?: number | null
  /** Quando true, queda é positiva (ex.: chamados abertos). */
  invertDelta?: boolean
  note?: React.ReactNode
  spark?: number[]
  menu?: MetricMenuItem[]
  loading?: boolean
  className?: string
}

/** Mini gráfico de barras em SVG puro — leve o bastante para vários KPIs na mesma tela. */
export function Sparkbars({ values, className }: { values: number[]; className?: string }) {
  const data = values.slice(-7)
  const max = Math.max(...data, 1)
  const w = 6, gap = 4
  const width = data.length * (w + gap) - gap
  return (
    <svg viewBox={`0 0 ${width} 36`} className={cn("h-9 shrink-0", className)} style={{ width }} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max(3, (v / max) * 36)
        const last = i === data.length - 1
        return <rect key={i} x={i * (w + gap)} y={36 - h} width={w} height={h} rx={2} fill="var(--core-yellow)" opacity={last ? 1 : 0.35 + (i / data.length) * 0.45} />
      })}
    </svg>
  )
}

export function DeltaPill({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const up = delta >= 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", good ? "text-emerald-400" : "text-red-400")}>
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  )
}

export function MetricCard({ icon, label, value, delta, invertDelta, note, spark, menu, loading, className }: MetricCardProps) {
  return (
    <GlassCard interactive className={cn("flex min-h-[124px] flex-col justify-between gap-3 p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={icon} />
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        {menu?.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Opções de ${label}`} className="-mr-1 -mt-1 grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menu.map((item) => <DropdownMenuItem key={item.label} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {loading ? (
        <div className="space-y-2"><Skeleton className="h-7 w-28" /><Skeleton className="h-3 w-36" /></div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">{value}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
              {typeof delta === "number" && Number.isFinite(delta) && <DeltaPill delta={delta} invert={invertDelta} />}
              {note}
            </p>
          </div>
          {spark && spark.some((v) => v > 0) && <Sparkbars values={spark} />}
        </div>
      )}
    </GlassCard>
  )
}
