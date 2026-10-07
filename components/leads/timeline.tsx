"use client"

import Link from "next/link"
import { History } from "lucide-react"
import { relativeTime } from "@/components/core/api-types"
import { EmptyState, Skeleton } from "@/components/core/states"
import { activityMeta } from "@/components/leads/utils"
import { stageMeta, type LeadActivity } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

/** Marca que liga a atividade "Reunião" do lead à ata gerada pela IA (ver lib/server/meet-process.ts). */
const MEETING_MARKER = /\s*\[reuniao:([0-9a-f-]+)\]\s*/

/** Linha do tempo de atividades de lead. `showLead` exibe o lead de cada item (feed global). */
export function Timeline({ items, loading, empty, showLead = false }: { items: LeadActivity[]; loading: boolean; empty: string; showLead?: boolean }) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
  if (!items.length) return <EmptyState icon={History} title={empty} className="border-white/[0.06]" />
  return (
    <ol className="relative space-y-1 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-white/[0.07]">
      {items.map((a) => {
        const meta = activityMeta[a.kind] ?? activityMeta.note
        const text = a.kind === "stage_change"
          ? `${a.from_stage ? stageMeta(a.from_stage).label : "—"} → ${a.to_stage ? stageMeta(a.to_stage).label : "—"}`
          : a.description && a.description !== meta.label ? a.description.replace(MEETING_MARKER, "").trim() : null
        const meetingId = a.kind === "meeting" ? a.description?.match(MEETING_MARKER)?.[1] : undefined
        return (
          <li key={a.id} className="relative flex gap-3 rounded-xl p-1.5">
            <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full border bg-[#111113]", meta.tone)}><meta.icon className="size-4" /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-foreground">
                  {meta.label}
                  {showLead && a.lead && <> · <Link href={`/leads/${a.lead.id}`} className="text-primary hover:underline">{a.lead.company_name}</Link></>}
                </p>
                <time className="text-xs text-subtle" dateTime={a.created_at} title={new Date(a.created_at).toLocaleString("pt-BR")}>{relativeTime(a.created_at)}</time>
              </div>
              {text && <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-300">{text}</p>}
              {meetingId && <Link href={`/reunioes/${meetingId}`} className="mt-1 inline-block text-xs text-primary hover:underline">Abrir ata da reunião</Link>}
              {a.kind === "stage_change" && a.description && <p className="mt-0.5 text-xs text-subtle">{a.description}</p>}
              <p className="mt-0.5 text-xs text-subtle">{a.author?.full_name ?? "Sistema"}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
