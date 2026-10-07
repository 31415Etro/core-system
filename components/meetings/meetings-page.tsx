"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AudioLines, CalendarClock, CheckCircle2, Database, ListChecks, Loader2, Mic, Play, Plug, Sparkles, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/components/core/data-table"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { MetricCard } from "@/components/core/metric-card"
import { notify } from "@/components/core/notify"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { AudioModal } from "@/components/meetings/audio-modal"
import { VideoModal } from "@/components/meetings/video-modal"
import { ExtensionSetupModal } from "@/components/meetings/extension-setup"
import {
  apiJson, fmtDateTime, hasAudio, hasVideo, fmtDay, fmtDuration, linkedHref, linkedName, MeetingStatusBadge, MeetingTypeBadge, TYPE_META,
  type MeetingListItem, type MeetingPending,
} from "@/components/meetings/shared"
import { PageLayout } from "@/components/page-layout"
import { useQueryParam } from "@/lib/use-query-param"
import { cn } from "@/lib/utils"

const TABS = ["realizadas", "proximas", "gravacoes", "pendencias"] as const
type Tab = (typeof TABS)[number]
type PendingRow = MeetingPending & { meeting: MeetingListItem }

export function MeetingsPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null)
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null)
  const [pending, setPending] = useState<PendingRow[]>([])
  const [tab, setTab] = useState<Tab>("realizadas")
  const [setupOpen, setSetupOpen] = useState(false)
  const [type, setType] = useState<"all" | "interna" | "cliente" | "lead">("all")
  const [playing, setPlaying] = useState<MeetingListItem | null>(null)
  const [watching, setWatching] = useState<MeetingListItem | null>(null)
  useQueryParam("aba", (v) => setTab((TABS as readonly string[]).includes(v) ? (v as Tab) : "realizadas"), { keep: true })
  useQueryParam("conectar", () => setSetupOpen(true))

  const load = useCallback(async () => {
    try {
      const { meetings } = await apiJson<{ meetings: MeetingListItem[] }>("/api/meetings")
      setMeetings(meetings)
      setFailure(null)
      // Pendências em aberto (detalhe só das reuniões que têm alguma)
      const withPending = meetings.filter((m) => m.meeting_pending.some((p) => !p.done)).slice(0, 30)
      const details = await Promise.all(withPending.map((m) => apiJson<{ meeting: { meeting_pending: MeetingPending[] } }>(`/api/meetings/${m.id}`).then((d) => d.meeting.meeting_pending.map((p) => ({ ...p, meeting: m }))).catch(() => [])))
      setPending(details.flat())
    } catch (err) {
      setMeetings([])
      setFailure({ message: err instanceof Error ? err.message : "Erro ao carregar", code: (err as { code?: string }).code })
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Enquanto houver reunião gravando/processando, atualiza sozinho.
  const busy = meetings?.some((m) => m.status === "gravando" || m.status === "processando")
  useEffect(() => {
    if (!busy) return
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [busy, load])

  function changeTab(next: string) {
    setTab(next as Tab)
    router.replace(`/reunioes?aba=${next}`, { scroll: false })
  }

  const list = (meetings ?? []).filter((m) => type === "all" || m.type === type)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = useMemo(() => (meetings ?? [])
    .filter((m) => m.next_meeting?.scheduled && m.next_meeting.date && m.next_meeting.date >= today)
    .sort((a, b) => `${a.next_meeting!.date}${a.next_meeting!.time}`.localeCompare(`${b.next_meeting!.date}${b.next_meeting!.time}`)), [meetings, today])
  const recordings = (meetings ?? []).filter((m) => m.meeting_audio_parts?.length)
  const openTasks = (meetings ?? []).reduce((s, m) => s + m.meeting_tasks.filter((t) => t.status === "sugerida").length, 0)
  const openPending = pending.filter((p) => !p.done)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  async function togglePending(p: PendingRow) {
    setPending((cur) => cur.map((x) => (x.id === p.id ? { ...x, done: !p.done } : x)))
    try { await apiJson(`/api/meeting-pending/${p.id}`, { method: "PATCH", body: JSON.stringify({ done: !p.done }) }) }
    catch (err) { setPending((cur) => cur.map((x) => (x.id === p.id ? p : x))); notify.error("Não foi possível atualizar", err instanceof Error ? err.message : undefined) }
  }


  const columns: DataTableColumn<MeetingListItem>[] = [
    { id: "reuniao", header: "Reunião", value: (m) => m.title, cell: (m) => (
      <div className="min-w-0 max-w-[380px]">
        <p className="truncate font-medium text-foreground">{m.title}</p>
        <p className="truncate text-xs text-subtle">{m.status === "erro" ? m.error : m.summary || (m.participants.length ? m.participants.join(", ") : "Sem resumo ainda")}</p>
      </div>
    ) },
    { id: "tipo", header: "Tipo", value: (m) => m.type, cell: (m) => (
      <div className="space-y-1"><MeetingTypeBadge type={m.type} />{linkedName(m) && <p className="max-w-[180px] truncate text-xs text-zinc-300">{linkedName(m)}</p>}</div>
    ) },
    { id: "data", header: "Data", value: (m) => m.started_at, cell: (m) => <span className="tabular-nums text-zinc-300">{fmtDateTime(m.started_at)}</span> },
    { id: "duracao", header: "Duração", value: (m) => m.duration_seconds ?? 0, cell: (m) => <span className="text-zinc-300">{fmtDuration(m.duration_seconds)}</span> },
    { id: "status", header: "Status", value: (m) => m.status, cell: (m) => <MeetingStatusBadge status={m.status} /> },
    { id: "tarefas", header: "Tarefas da IA", align: "right", value: (m) => m.meeting_tasks.filter((t) => t.status === "sugerida").length, cell: (m) => {
      const n = m.meeting_tasks.filter((t) => t.status === "sugerida").length
      return n ? <span className="font-medium text-primary">{n} para revisar</span> : <span className="text-subtle">—</span>
    } },
  ]

  if (failure?.code === "not_installed") {
    return (
      <PageLayout><PageContainer>
        <PageHeader title="Reuniões" description="Gravação pelo CORE Meet, ata e tarefas pela IA." />
        <GlassCard><EmptyState icon={Database} title="Reuniões ainda não instaladas no banco" description="Execute o script 221_core_meet.sql no Supabase para habilitar as reuniões." className="border-white/[0.06] py-12" /></GlassCard>
      </PageContainer></PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Reuniões"
          description="Grave pelo CORE Meet no Google Meet. O áudio é transcrito gratuitamente e a IA escreve a ata, as tarefas e as pendências."
          actions={<Button onClick={() => setSetupOpen(true)}><Plug /> Conectar extensão</Button>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Video} label="Reuniões no mês" value={(meetings ?? []).filter((m) => m.started_at >= monthStart).length} note={`${meetings?.length ?? 0} no total`} loading={!meetings} />
          <MetricCard icon={Sparkles} label="Tarefas para revisar" value={openTasks} note="Sugeridas pela IA" loading={!meetings} />
          <MetricCard icon={ListChecks} label="Pendências abertas" value={openPending.length} note={`${openPending.filter((p) => p.side === "cliente").length} do lado do cliente`} loading={!meetings} />
          <MetricCard icon={CalendarClock} label="Próximas reuniões" value={upcoming.length} note="Combinadas nas reuniões" loading={!meetings} />
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList aria-label="Seções de reuniões">
            <TabsTrigger value="realizadas">Realizadas</TabsTrigger>
            <TabsTrigger value="proximas">Próximas{upcoming.length ? ` (${upcoming.length})` : ""}</TabsTrigger>
            <TabsTrigger value="gravacoes">Gravações</TabsTrigger>
            <TabsTrigger value="pendencias">Pendências{openPending.length ? ` (${openPending.length})` : ""}</TabsTrigger>
          </TabsList>

          {failure && <div className="mt-4"><ErrorState message={failure.message} onRetry={load} /></div>}

          <TabsContent value="realizadas" className="mt-4">
            {meetings && !meetings.length && !failure ? (
              <GlassCard>
                <EmptyState icon={Mic} title="Nenhuma reunião gravada ainda" description="Instale a extensão CORE Meet, entre numa reunião do Google Meet e clique em Iniciar gravação. A ata aparece aqui minutos depois." action={<Button size="sm" onClick={() => setSetupOpen(true)}><Plug /> Conectar extensão</Button>} className="border-white/[0.06] py-12" />
              </GlassCard>
            ) : (
              <DataTable
                data={list}
                columns={columns}
                getRowId={(m) => m.id}
                loading={!meetings}
                searchText={(m) => `${m.title} ${m.summary ?? ""} ${linkedName(m) ?? ""} ${m.participants.join(" ")}`}
                searchPlaceholder="Buscar reunião, cliente, participante..."
                onRowClick={(m) => router.push(`/reunioes/${m.id}`)}
                pageSize={12}
                toolbar={
                  <div className="flex flex-wrap gap-2">
                    {(["all", "interna", "cliente", "lead"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", type === t ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                        {t === "all" ? "Todas" : TYPE_META[t].label}
                      </button>
                    ))}
                  </div>
                }
                empty={{ title: "Nenhuma reunião deste tipo" }}
              />
            )}
          </TabsContent>

          <TabsContent value="proximas" className="mt-4">
            {upcoming.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((m) => (
                  <GlassCard key={m.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold capitalize tracking-tight text-foreground">{fmtDay(m.next_meeting!.date)}</p>
                        <p className="text-sm text-primary">{m.next_meeting!.time || "Horário a definir"}</p>
                      </div>
                      <MeetingTypeBadge type={m.type} />
                    </div>
                    <p className="text-sm text-zinc-300">{m.next_meeting!.agenda || "Pauta não definida"}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-xs text-subtle">
                      {linkedHref(m) && <Link href={linkedHref(m)!} className="text-primary hover:underline">{linkedName(m)}</Link>}
                      <Link href={`/reunioes/${m.id}`} className="hover:text-foreground">Combinada em “{m.title}”</Link>
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <GlassCard><EmptyState icon={CalendarClock} title="Nenhuma próxima reunião combinada" description="Quando uma reunião gravada combinar o próximo encontro, a IA traz a data e a pauta para cá." className="border-white/[0.06] py-12" /></GlassCard>
            )}
          </TabsContent>

          <TabsContent value="gravacoes" className="mt-4">
            {!meetings ? <Skeleton className="h-40 rounded-[20px]" /> : recordings.length ? (
              <GlassCard padded={false} className="overflow-hidden">
                <ul className="divide-y divide-white/[0.06]">
                  {recordings.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><AudioLines className="size-[18px]" /></span>
                      <Link href={`/reunioes/${m.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{m.title}</p>
                        <p className="text-xs text-subtle">{fmtDateTime(m.started_at)} · {fmtDuration(m.duration_seconds)}{linkedName(m) ? ` · ${linkedName(m)}` : ""}</p>
                      </Link>
                      <MeetingStatusBadge status={m.status} />
                      {hasVideo(m) && <Button variant="outline" size="sm" onClick={() => setWatching(m)}><Video /> Assistir</Button>}
                      {hasAudio(m) && <Button variant="outline" size="sm" onClick={() => setPlaying(m)}><Play /> Ouvir</Button>}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ) : (
              <GlassCard><EmptyState icon={AudioLines} title="Nenhuma gravação ainda" description="O áudio de cada reunião (seu microfone e o som do Meet) e o vídeo, quando gravado, ficam guardados aqui." className="border-white/[0.06] py-12" /></GlassCard>
            )}
          </TabsContent>

          <TabsContent value="pendencias" className="mt-4">
            {pending.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {(["nossa", "cliente"] as const).map((side) => {
                  const items = pending.filter((p) => p.side === side).sort((a, b) => Number(a.done) - Number(b.done))
                  return (
                    <GlassCard key={side} className="space-y-3">
                      <CardHeader icon={side === "nossa" ? CheckCircle2 : Loader2} title={side === "nossa" ? "Nossa responsabilidade" : "Responsabilidade do cliente"} description={`${items.filter((p) => !p.done).length} em aberto`} />
                      {items.length ? (
                        <ul className="divide-y divide-white/[0.05]">
                          {items.map((p) => (
                            <li key={p.id} className="flex items-start gap-3 py-2.5">
                              <Checkbox checked={p.done} onCheckedChange={() => togglePending(p)} aria-label={`Marcar “${p.description}” como resolvida`} className="mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-sm", p.done ? "text-subtle line-through" : "text-foreground")}>{p.description}</p>
                                <p className="text-xs text-subtle">
                                  {[p.owner, linkedName(p.meeting)].filter(Boolean).join(" · ")}{" "}
                                  <Link href={`/reunioes/${p.meeting.id}`} className="hover:text-foreground">· {p.meeting.title}</Link>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="py-4 text-sm text-muted-foreground">Nada pendente.</p>}
                    </GlassCard>
                  )
                })}
              </div>
            ) : (
              <GlassCard><EmptyState icon={ListChecks} title="Nenhuma pendência em aberto" description="A IA separa o que é nosso e o que o cliente precisa enviar em cada reunião." className="border-white/[0.06] py-12" /></GlassCard>
            )}
          </TabsContent>
        </Tabs>

        <ExtensionSetupModal open={setupOpen} onOpenChange={setSetupOpen} />
        {watching && <VideoModal meetingId={watching.id} title={watching.title} open onOpenChange={(o) => { if (!o) setWatching(null) }} />}
        {playing && <AudioModal meetingId={playing.id} title={playing.title} open onOpenChange={(o) => { if (!o) setPlaying(null) }} />}
      </PageContainer>
    </PageLayout>
  )
}
