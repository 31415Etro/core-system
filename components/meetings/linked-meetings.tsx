"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ListChecks, Mic, Plug, Sparkles, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { StatusBadge } from "@/components/core/status-badge"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { apiJson, fmtDateTime, fmtDuration, MeetingStatusBadge, type MeetingListItem, type MeetingPending, type MeetingTask } from "@/components/meetings/shared"
import { cn } from "@/lib/utils"

type FullMeeting = Omit<MeetingListItem, "meeting_tasks" | "meeting_pending"> & { meeting_tasks: MeetingTask[]; meeting_pending: MeetingPending[] }

/** Reuniões, tarefas e pendências de um lead ou cliente (abas da página do lead/cliente). */
export function LinkedMeetings({ leadId, clientId, view }: { leadId?: string; clientId?: string; view: "reunioes" | "tarefas" | "pendencias" }) {
  const [meetings, setMeetings] = useState<FullMeeting[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const query = leadId ? `lead_id=${leadId}` : `client_id=${clientId}`

  const load = useCallback(async () => {
    try { setMeetings((await apiJson<{ meetings: FullMeeting[] }>(`/api/meetings?${query}&full=1`)).meetings); setError(null) }
    catch (err) { setMeetings([]); setError(err instanceof Error ? err.message : "Erro") }
  }, [query])
  useEffect(() => { load() }, [load])

  async function togglePending(p: MeetingPending) {
    setMeetings((cur) => cur && cur.map((m) => ({ ...m, meeting_pending: m.meeting_pending.map((x) => (x.id === p.id ? { ...x, done: !p.done } : x)) })))
    try { await apiJson(`/api/meeting-pending/${p.id}`, { method: "PATCH", body: JSON.stringify({ done: !p.done }) }) } catch { load() }
  }

  if (!meetings) return <Skeleton className="h-40 rounded-[20px]" />
  if (error) return <ErrorState message={error} onRetry={load} />

  if (!meetings.length) {
    return (
      <GlassCard>
        <EmptyState icon={Mic} title="Nenhuma reunião gravada" description={`Grave a próxima reunião pelo CORE Meet escolhendo este ${leadId ? "lead" : "cliente"}: a ata, as tarefas e as pendências aparecem aqui${leadId ? " e no histórico do lead" : ""}.`}
          action={<Button size="sm" variant="outline" asChild><Link href="/reunioes?conectar=1"><Plug /> Conectar extensão</Link></Button>} className="border-white/[0.06] py-12" />
      </GlassCard>
    )
  }

  if (view === "reunioes") {
    return (
      <div className="space-y-3">
        {meetings.map((m) => (
          <Link key={m.id} href={`/reunioes/${m.id}`} className="glass interactive-lift block rounded-[20px] p-5 focus-visible:outline-2 focus-visible:outline-ring">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Video className="size-[18px]" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{m.title}</p>
                  <p className="text-xs text-subtle">{fmtDateTime(m.started_at)} · {fmtDuration(m.duration_seconds)}{m.participants.length ? ` · ${m.participants.join(", ")}` : ""}</p>
                </div>
              </div>
              <MeetingStatusBadge status={m.status} />
            </div>
            {m.summary && <p className="mt-3 line-clamp-3 text-sm text-zinc-300">{m.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
              <span>{m.meeting_tasks.length} tarefas</span>
              <span>{m.meeting_pending.filter((p) => !p.done).length} pendências abertas</span>
              {m.next_meeting?.scheduled && m.next_meeting.date && <span className="text-primary">Próxima: {new Date(`${m.next_meeting.date}T12:00:00`).toLocaleDateString("pt-BR")}{m.next_meeting.time ? ` às ${m.next_meeting.time}` : ""}</span>}
            </div>
          </Link>
        ))}
      </div>
    )
  }

  if (view === "tarefas") {
    const tasks = meetings.flatMap((m) => m.meeting_tasks.filter((t) => t.status !== "ignorada").map((t) => ({ ...t, meeting: m })))
    return (
      <GlassCard className="space-y-3">
        <CardHeader icon={Sparkles} title="Tarefas das reuniões" description="Sugeridas pela IA. As pendentes de revisão são confirmadas na página da reunião." />
        {tasks.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-3">
                <StatusBadge tone={t.status === "criada" ? "success" : "warning"}>{t.status === "criada" ? "Criada" : "Para revisar"}</StatusBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{t.title}</p>
                  <p className="text-xs text-subtle">{[t.owner, t.due_date && `prazo ${new Date(`${t.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`].filter(Boolean).join(" · ")} · <Link href={`/reunioes/${t.meeting.id}`} className="hover:text-foreground">{t.meeting.title}</Link></p>
                </div>
                {t.status === "sugerida" ? <Button size="sm" variant="outline" asChild><Link href={`/reunioes/${t.meeting.id}`}>Revisar</Link></Button>
                  : t.task_id && <Link href={`/tickets?tarefa=${t.task_id}`} className="text-xs text-primary hover:underline">Abrir no kanban</Link>}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={ListChecks} title="Nenhuma tarefa ainda" className="border-white/[0.06]" />}
      </GlassCard>
    )
  }

  const pending = meetings.flatMap((m) => m.meeting_pending.map((p) => ({ ...p, meeting: m })))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["nossa", "cliente"] as const).map((side) => {
        const items = pending.filter((p) => p.side === side).sort((a, b) => Number(a.done) - Number(b.done))
        return (
          <GlassCard key={side} className="space-y-3">
            <CardHeader title={side === "nossa" ? "Pendências internas" : "Pendências do cliente"} description={`${items.filter((p) => !p.done).length} em aberto`} />
            {items.length ? (
              <ul className="divide-y divide-white/[0.05]">
                {items.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 py-2.5">
                    <Checkbox checked={p.done} onCheckedChange={() => togglePending(p)} aria-label={`Marcar “${p.description}”`} className="mt-0.5" />
                    <div className="min-w-0">
                      <p className={cn("text-sm", p.done ? "text-subtle line-through" : "text-foreground")}>{p.description}</p>
                      <p className="text-xs text-subtle">{p.owner ? `${p.owner} · ` : ""}<Link href={`/reunioes/${p.meeting.id}`} className="hover:text-foreground">{p.meeting.title}</Link></p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-sm text-muted-foreground">Nada pendente.</p>}
          </GlassCard>
        )
      })}
    </div>
  )
}
