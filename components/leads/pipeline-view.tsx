"use client"

import { useMemo, useState, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Clock3, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/core/states"
import { LeadAvatar } from "@/components/leads/shared"
import { daysInStage, isOpenStage, normalizeStage, PIPELINE_STAGES, type Lead, type PipelineStage } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const compact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : brl0(v))
const todayIso = () => new Date().toISOString().slice(0, 10)
const dot: Record<string, string> = { success: "bg-emerald-400", danger: "bg-red-400", info: "bg-sky-400", neutral: "bg-zinc-500", warning: "bg-primary", primary: "bg-primary" }

function LeadCard({ lead, ownerName, dragging, onDragStart, onDragEnd, onMove }: {
  lead: Lead; ownerName: string | null; dragging: boolean
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void; onMove: (stage: PipelineStage) => void
}) {
  const router = useRouter()
  const days = daysInStage(lead)
  const overdue = Boolean(lead.next_action_at) && lead.next_action_at!.slice(0, 10) < todayIso() && isOpenStage(lead.stage)
  const current = normalizeStage(lead.stage)
  const open = () => router.push(`/leads/${lead.id}`)
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter") open() }}
      tabIndex={0}
      aria-label={`${lead.company_name}, ${days} dias na etapa`}
      className={cn(
        "group cursor-grab rounded-2xl border border-white/[0.07] bg-[rgba(22,22,24,0.85)] p-3.5 shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-[transform,border-color,opacity] duration-150 hover:-translate-y-px hover:border-white/[0.14] focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-3">
        <LeadAvatar lead={lead} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{lead.company_name}</p>
          <p className="truncate text-xs text-subtle">{lead.contact_name || lead.segment || "Sem contato"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} aria-label={`Mover ${lead.company_name}`} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-subtle opacity-70 transition hover:bg-white/[0.06] hover:text-foreground group-hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={open}>Abrir lead</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-subtle">Mover para</DropdownMenuLabel>
            {PIPELINE_STAGES.filter((s) => s.id !== current).map((s) => <DropdownMenuItem key={s.id} onSelect={() => onMove(s.id)}>{s.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-[15px] font-semibold tabular-nums text-foreground">{brl0(Number((current === "fechado" ? lead.closed_value : null) ?? lead.estimated_value ?? 0))}</p>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums", days > 14 && isOpenStage(lead.stage) ? "border-orange-400/25 bg-orange-400/10 text-orange-300" : "border-white/[0.08] text-subtle")} title="Dias na etapa atual">
          <Clock3 className="size-3" />{days}d
        </span>
      </div>

      {(lead.next_action || lead.next_action_at) && (
        <p className={cn("mt-2.5 flex items-center gap-1.5 truncate text-xs", overdue ? "text-red-400" : "text-muted-foreground")}>
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">{lead.next_action || "Próxima ação"}{lead.next_action_at && ` · ${new Date(`${lead.next_action_at.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}</span>
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-2.5 text-xs text-subtle">
        <span className="grid size-5 place-items-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-zinc-300">{ownerName ? ownerName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "—"}</span>
        <span className="truncate">{ownerName ?? "Sem responsável"}</span>
      </div>
    </article>
  )
}

export function PipelineView({ leads, loading, ownerName, onMove }: { leads: Lead[]; loading: boolean; ownerName: (l: Lead) => string | null; onMove: (lead: Lead, stage: PipelineStage) => void }) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<PipelineStage | null>(null)

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, Lead[]>(PIPELINE_STAGES.map((s) => [s.id, []]))
    for (const l of leads) map.get(normalizeStage(l.stage))!.push(l)
    return map
  }, [leads])

  function drop(stage: PipelineStage) {
    const lead = leads.find((l) => l.id === dragged)
    setDragged(null)
    setOver(null)
    if (lead) onMove(lead, stage)
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6" role="region" aria-label="Quadro do pipeline">
      <div className="flex min-w-max gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const items = byStage.get(stage.id) ?? []
          const total = items.reduce((s, l) => s + Number((stage.id === "fechado" ? l.closed_value : null) ?? l.estimated_value ?? 0), 0)
          const isOver = over === stage.id
          return (
            <section
              key={stage.id}
              aria-label={stage.label}
              onDragOver={(e) => { e.preventDefault(); if (over !== stage.id) setOver(stage.id) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
              onDrop={(e) => { e.preventDefault(); drop(stage.id) }}
              className={cn(
                "flex max-h-[calc(100dvh-300px)] min-h-[420px] w-[280px] flex-col rounded-[20px] border transition-colors duration-150",
                isOver ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)]" : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", dot[stage.tone])} />
                  <h2 className="truncate text-sm font-semibold text-foreground">{stage.id === "fechado" ? "Fechado / Cliente" : stage.label}</h2>
                  <span className="rounded-full bg-white/[0.06] px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-subtle">{total ? compact(total) : ""}</span>
              </header>
              <div className="flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-3">
                {loading ? (
                  Array.from({ length: stage.id === "novo_lead" ? 3 : 1 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
                ) : items.length === 0 ? (
                  <p className={cn("rounded-xl border border-dashed px-3 py-6 text-center text-xs", isOver ? "border-primary/40 text-primary" : "border-white/[0.07] text-subtle")}>
                    {isOver ? "Soltar aqui" : "Nenhum lead"}
                  </p>
                ) : (
                  items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      ownerName={ownerName(lead)}
                      dragging={dragged === lead.id}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); setDragged(lead.id) }}
                      onDragEnd={() => { setDragged(null); setOver(null) }}
                      onMove={(s) => onMove(lead, s)}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
