"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { CardHeader, CardLink, GlassCard } from "@/components/core/glass-card"
import { isOpen, type ApiTask } from "@/components/core/api-types"
import { cn } from "@/lib/utils"

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"]
const pad = (n: number) => String(n).padStart(2, "0")
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const priorityBar: Record<string, string> = { alta: "bg-red-500", media: "bg-primary", baixa: "bg-sky-400" }

/** Mini agenda: prazos das tarefas/chamados em aberto, por dia. */
export function AgendaCard({ tasks, onOpenTask }: { tasks: ApiTask[]; onOpenTask: (t: ApiTask) => void }) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(keyOf(today))

  const byDay = useMemo(() => {
    const map = new Map<string, ApiTask[]>()
    for (const t of tasks) {
      if (!t.due_date || !isOpen(t)) continue
      const k = t.due_date.slice(0, 10)
      map.set(k, [...(map.get(k) ?? []), t])
    }
    return map
  }, [tasks])

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))]
  }, [cursor])

  const todayKey = keyOf(today)
  const items = byDay.get(selected) ?? []
  const selectedDate = new Date(`${selected}T12:00:00`)
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  return (
    <GlassCard className="flex flex-col gap-4">
      <CardHeader icon={CalendarDays} title="Agenda" description={`Hoje, ${today.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`} actions={<CardLink href="/tickets">Ver tarefas</CardLink>} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"><ChevronLeft className="size-4" /></button>
          <p className="text-sm font-medium capitalize text-foreground">{monthLabel}</p>
          <button type="button" aria-label="Próximo mês" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {WEEK.map((d, i) => <span key={i} className="py-1 text-[11px] text-subtle">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />
            const k = keyOf(d)
            const has = byDay.has(k)
            const isToday = k === todayKey
            const isSel = k === selected
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-pressed={isSel}
                aria-label={`${d.toLocaleDateString("pt-BR")}${has ? `, ${byDay.get(k)!.length} prazo(s)` : ""}`}
                className={cn(
                  "relative mx-auto grid size-8 place-items-center rounded-full tabular-nums transition-colors",
                  isToday ? "bg-core-gradient font-semibold text-black shadow-[0_0_16px_rgba(255,196,0,0.35)]" : isSel ? "bg-white/[0.1] text-foreground" : "text-zinc-300 hover:bg-white/[0.06]",
                )}
              >
                {d.getDate()}
                {has && !isToday && <span className="absolute bottom-0.5 size-1 rounded-full bg-primary" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-white/[0.06] pt-3">
        <p className="text-xs text-subtle">Prazos em {selectedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhum prazo neste dia.</p>
        ) : (
          items.slice(0, 4).map((t) => (
            <button key={t.id} type="button" onClick={() => onOpenTask(t)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
              <span className={cn("h-8 w-[3px] shrink-0 rounded-full", priorityBar[t.priority] ?? "bg-zinc-500")} />
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{t.title || t.os_number}</span>
                <span className="block truncate text-xs text-subtle">{t.company_name || (t.kind === "chamado" ? "Chamado" : "Tarefa interna")}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </GlassCard>
  )
}
