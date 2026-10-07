"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, CheckCircle2, ExternalLink, FileText, Gavel, HelpCircle, ListChecks, Loader2,
  Play, RefreshCw, Sparkles, Target, Trash2, Users, Video, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { PageContainer } from "@/components/core/page-header"
import { StatusBadge } from "@/components/core/status-badge"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import {
  apiJson, fmtDateTime, hasAudio, hasVideo, fmtDay, fmtDuration, linkedHref, linkedName, MeetingStatusBadge, MeetingTypeBadge,
  type MeetingDetail, type MeetingPending, type MeetingTask,
} from "@/components/meetings/shared"
import { AudioModal } from "@/components/meetings/audio-modal"
import { VideoModal } from "@/components/meetings/video-modal"
import { ClientProjectPicker } from "@/components/core/client-project-picker"
import { PageLayout } from "@/components/page-layout"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

type Draft = { selected: boolean; title: string; description: string; due_date: string; priority: "baixa" | "media" | "alta"; scope: "avulsa" | "projeto"; client_id: string; project_id: string }
const PRIORITY_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta" } as const

function Bullets({ items }: { items: string[] }) {
  return <ul className="space-y-1.5">{items.map((i, n) => <li key={n} className="flex gap-2 text-sm text-zinc-300"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{i}</li>)}</ul>
}

/** Revisão das tarefas sugeridas: avulsa (kanban) ou de projeto (vinculada a um cliente). */
function TasksReview({ meeting, onApplied }: { meeting: MeetingDetail; onApplied: () => void }) {
  const clients = useApi<{ clients: { id: string; name: string }[] }>("/api/clients").data?.clients ?? []
  const suggested = meeting.meeting_tasks.filter((t) => t.status === "sugerida")
  const done = meeting.meeting_tasks.filter((t) => t.status !== "sugerida")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDrafts(Object.fromEntries(suggested.map((t) => [t.id, {
      selected: true, title: t.title, description: t.description ?? "", due_date: t.due_date ?? "", priority: t.priority,
      scope: t.scope, client_id: t.client_id ?? meeting.client_id ?? "", project_id: "",
    }])))
  }, [meeting.id, meeting.processed_at, suggested.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id: string, patch: Partial<Draft>) => setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }))
  const selected = suggested.filter((t) => drafts[t.id]?.selected)
  const missingClient = selected.some((t) => drafts[t.id].scope === "projeto" && !drafts[t.id].client_id)

  async function apply(mode: "create" | "ignore") {
    setSaving(true)
    try {
      const body = mode === "create"
        ? { create: selected.map((t) => ({ id: t.id, ...drafts[t.id], due_date: drafts[t.id].due_date || null, client_id: drafts[t.id].scope === "projeto" ? drafts[t.id].client_id : null, project_id: drafts[t.id].scope === "projeto" ? drafts[t.id].project_id || null : null })), ignore: [] }
        : { create: [], ignore: selected.map((t) => t.id) }
      const result = await apiJson<{ created: number; ignored: number }>(`/api/meetings/${meeting.id}/tasks`, { method: "POST", body: JSON.stringify(body) })
      notify.success(mode === "create" ? `${result.created} tarefa(s) criada(s)` : `${result.ignored} sugestão(ões) ignorada(s)`, mode === "create" ? "Já estão no kanban de Tarefas." : undefined)
      onApplied()
    } catch (err) {
      notify.error("Não foi possível aplicar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {suggested.length > 0 ? (
        <GlassCard className="space-y-4">
          <CardHeader icon={Sparkles} title="Tarefas identificadas pela IA" description="Revise, edite e escolha: avulsa (kanban de Tarefas) ou de projeto (vinculada a um cliente)."
            actions={<label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={selected.length === suggested.length} onCheckedChange={(v) => suggested.forEach((t) => set(t.id, { selected: Boolean(v) }))} aria-label="Selecionar todas" />Todas</label>} />
          <ul className="space-y-3">
            {suggested.map((t) => {
              const d = drafts[t.id]
              if (!d) return null
              return (
                <li key={t.id} className={cn("rounded-2xl border p-4 transition-colors", d.selected ? "border-white/[0.1] bg-white/[0.02]" : "border-white/[0.05] opacity-60")}>
                  <div className="flex gap-3">
                    <Checkbox checked={d.selected} onCheckedChange={(v) => set(t.id, { selected: Boolean(v) })} aria-label={`Selecionar ${d.title}`} className="mt-3" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <Input value={d.title} onChange={(e) => set(t.id, { title: e.target.value })} aria-label="Título da tarefa" className="h-10 font-medium" />
                      <Textarea value={d.description} onChange={(e) => set(t.id, { description: e.target.value })} aria-label="Descrição" className="min-h-16 text-sm" />
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="inline-flex rounded-xl border border-border bg-white/[0.04] p-1" role="radiogroup" aria-label="Tipo de tarefa">
                          {(["avulsa", "projeto"] as const).map((s) => (
                            <button key={s} type="button" role="radio" aria-checked={d.scope === s} onClick={() => set(t.id, { scope: s })}
                              className={cn("h-8 rounded-lg px-3 text-xs font-medium transition-colors", d.scope === s ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                              {s === "avulsa" ? "Avulsa (kanban)" : "De projeto (cliente)"}
                            </button>
                          ))}
                        </div>
                        <Select value={d.priority} onValueChange={(v) => set(t.id, { priority: v as Draft["priority"] })}>
                          <SelectTrigger className="h-10 w-[130px]" aria-label="Prioridade"><SelectValue /></SelectTrigger>
                          <SelectContent>{(["baixa", "media", "alta"] as const).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="date" value={d.due_date} onChange={(e) => set(t.id, { due_date: e.target.value })} aria-label="Prazo" className="h-10 w-[160px]" />
                        {t.owner && <span className="text-xs text-subtle">Responsável citado: {t.owner}</span>}
                      </div>
                      {d.scope === "projeto" && (
                        <ClientProjectPicker requireClient clients={clients} clientId={d.client_id || null} projectId={d.project_id || null}
                          onChange={(link) => set(t.id, { client_id: link.clientId ?? "", project_id: link.projectId ?? "" })} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {missingClient && <p className="mr-auto text-xs text-red-400">Escolha o cliente das tarefas de projeto.</p>}
            <Button variant="ghost" disabled={!selected.length || saving} onClick={() => apply("ignore")}><X /> Ignorar selecionadas</Button>
            <Button disabled={!selected.length || saving || missingClient} onClick={() => apply("create")}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Criar {selected.length} tarefa(s)</Button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard><EmptyState icon={ListChecks} title={meeting.status === "concluida" ? "Nenhuma tarefa pendente de revisão" : "As tarefas aparecem quando a IA terminar"} className="border-white/[0.06] py-10" /></GlassCard>
      )}

      {done.length > 0 && (
        <GlassCard className="space-y-3">
          <CardHeader icon={CheckCircle2} title="Já aplicadas" />
          <ul className="divide-y divide-white/[0.05]">
            {done.map((t: MeetingTask) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                <StatusBadge tone={t.status === "criada" ? "success" : "neutral"}>{t.status === "criada" ? "Criada" : "Ignorada"}</StatusBadge>
                <span className={cn("min-w-0 flex-1 truncate", t.status === "ignorada" ? "text-subtle line-through" : "text-foreground")}>{t.title}</span>
                {t.status === "criada" && <span className="text-xs text-subtle">{t.scope === "projeto" ? `Projeto · ${t.client?.name ?? "cliente"}` : "Avulsa"}</span>}
                {t.task_id && <Link href={`/tickets?tarefa=${t.task_id}`} className="text-xs text-primary hover:underline">Abrir no kanban</Link>}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  )
}

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("resumo")
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState("")
  const [audioOpen, setAudioOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const load = useCallback(async () => {
    try { setMeeting((await apiJson<{ meeting: MeetingDetail }>(`/api/meetings/${id}`)).meeting); setError(null) }
    catch (err) { setError(err instanceof Error ? err.message : "Erro ao carregar") }
  }, [id])
  useEffect(() => { load() }, [load])

  const busy = meeting?.status === "gravando" || meeting?.status === "processando"
  useEffect(() => {
    if (!busy) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [busy, load])

  async function reprocess(retranscribe = false) {
    try { await apiJson(`/api/meetings/${id}/process`, { method: "POST", body: JSON.stringify({ retranscribe }) }); notify.info(retranscribe ? "Transcrevendo o áudio de novo" : "Reprocessando com a IA", "A ata é atualizada em instantes."); load() }
    catch (err) { notify.error("Não foi possível reprocessar", err instanceof Error ? err.message : undefined) }
  }


  async function togglePending(p: MeetingPending) {
    setMeeting((m) => m && { ...m, meeting_pending: m.meeting_pending.map((x) => (x.id === p.id ? { ...x, done: !p.done } : x)) })
    try { await apiJson(`/api/meeting-pending/${p.id}`, { method: "PATCH", body: JSON.stringify({ done: !p.done }) }) }
    catch { load() }
  }

  async function remove() {
    setDeleting(false)
    try { await apiJson(`/api/meetings/${id}`, { method: "DELETE" }); notify.success("Reunião excluída"); router.push("/reunioes") }
    catch (err) { notify.error("Não foi possível excluir", err instanceof Error ? err.message : undefined) }
  }

  const transcriptLines = useMemo(() => (meeting?.transcript ?? "").split("\n").filter((l) => !query || l.toLowerCase().includes(query.toLowerCase())), [meeting?.transcript, query])

  if (error) return <PageLayout><PageContainer><ErrorState message={error} onRetry={load} /><Button variant="ghost" asChild><Link href="/reunioes"><ArrowLeft /> Voltar</Link></Button></PageContainer></PageLayout>
  if (!meeting) return <PageLayout><PageContainer><Skeleton className="h-32 rounded-[20px]" /><Skeleton className="h-72 rounded-[20px]" /></PageContainer></PageLayout>

  const minutes = meeting.minutes
  const insights = meeting.lead_insights
  const suggestedCount = meeting.meeting_tasks.filter((t) => t.status === "sugerida").length
  const openPending = meeting.meeting_pending.filter((p) => !p.done).length
  const href = linkedHref(meeting)

  return (
    <PageLayout>
      <PageContainer>
        <Link href="/reunioes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Reuniões</Link>

        <GlassCard className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{meeting.title}</h1>
              <MeetingStatusBadge status={meeting.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <MeetingTypeBadge type={meeting.type} />
              {href && <Link href={href} className="font-medium text-primary hover:underline">{linkedName(meeting)}</Link>}
              <span>{fmtDateTime(meeting.started_at)}</span>
              <span>{fmtDuration(meeting.duration_seconds)}</span>
              {meeting.participants.length > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{meeting.participants.join(", ")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {meeting.meet_url && <Button variant="outline" asChild><a href={meeting.meet_url} target="_blank" rel="noreferrer"><ExternalLink /> Meet</a></Button>}
            {hasVideo(meeting) && <Button variant="outline" onClick={() => setVideoOpen(true)}><Video /> Assistir vídeo</Button>}
            {hasAudio(meeting) && <Button variant="outline" onClick={() => setAudioOpen(true)}><Play /> Ouvir áudio</Button>}
            {!busy && <Button variant="outline" onClick={() => reprocess()}><RefreshCw /> Reprocessar com IA</Button>}
            <Button variant="ghost" onClick={() => setDeleting(true)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 /></Button>
          </div>
        </GlassCard>

        {meeting.status === "processando" && (
          <GlassCard highlight className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-primary" /><p className="text-sm text-zinc-300">A IA está escrevendo a ata, as tarefas e as pendências. Isso leva poucos segundos a alguns minutos.</p></GlassCard>
        )}
        {meeting.status === "gravando" && (
          <GlassCard className="flex items-center gap-3"><span className="size-2.5 animate-pulse rounded-full bg-red-500" /><p className="text-sm text-zinc-300">Gravação em andamento na extensão CORE Meet.</p></GlassCard>
        )}
        {meeting.status === "erro" && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0 text-red-400" />
            <p className="flex-1 text-sm text-red-200">{meeting.error}</p>
            {meeting.transcript && <Button variant="ghost" size="sm" onClick={() => reprocess(true)}>Transcrever de novo</Button>}
            <Button variant="outline" size="sm" onClick={() => reprocess(!meeting.transcript)}><RefreshCw /> Tentar de novo</Button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Seções da reunião">
            <TabsTrigger value="resumo">Resumo e ata</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas{suggestedCount ? ` (${suggestedCount})` : ""}</TabsTrigger>
            <TabsTrigger value="pendencias">Pendências{openPending ? ` (${openPending})` : ""}</TabsTrigger>
            <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4">
            {!meeting.summary ? (
              <GlassCard><EmptyState icon={FileText} title="A ata ainda não foi gerada" description={busy ? "Aguarde a IA terminar." : "Use “Reprocessar com IA”."} className="border-white/[0.06] py-12" /></GlassCard>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <GlassCard className="space-y-3"><CardHeader icon={Sparkles} title="Resumo" /><p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{meeting.summary}</p></GlassCard>
                  {minutes?.topics?.length ? (
                    <GlassCard className="space-y-4">
                      <CardHeader icon={FileText} title="Ata" description="Assuntos tratados, na ordem da reunião" />
                      <ol className="space-y-4">
                        {minutes.topics.map((t, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold text-zinc-300">{i + 1}</span>
                            <div><p className="font-medium text-foreground">{t.title}</p><p className="mt-0.5 text-sm text-zinc-300">{t.notes}</p></div>
                          </li>
                        ))}
                      </ol>
                    </GlassCard>
                  ) : null}
                  {insights && (insights.pain_points.length || insights.requirements.length || insights.budget) ? (
                    <GlassCard className="space-y-4">
                      <CardHeader icon={Target} title="Informações comerciais" description={`Interesse: ${insights.interest_level}`} />
                      <div className="grid gap-5 sm:grid-cols-2">
                        {insights.pain_points.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Dores</p><Bullets items={insights.pain_points} /></div>}
                        {insights.requirements.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Necessidades</p><Bullets items={insights.requirements} /></div>}
                        {insights.decision_makers.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Decisores</p><Bullets items={insights.decision_makers} /></div>}
                        {insights.objections.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Objeções</p><Bullets items={insights.objections} /></div>}
                        {insights.proposal_items.length > 0 && <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Itens para a proposta</p><Bullets items={insights.proposal_items} /></div>}
                      </div>
                      {insights.budget && <p className="border-t border-white/[0.06] pt-3 text-sm text-zinc-300"><span className="text-subtle">Orçamento citado: </span>{insights.budget}</p>}
                    </GlassCard>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <GlassCard highlight={Boolean(meeting.next_meeting?.scheduled)} className="space-y-2">
                    <CardHeader icon={CalendarClock} title="Próxima reunião" />
                    {meeting.next_meeting?.scheduled ? (
                      <>
                        <p className="text-lg font-semibold capitalize text-foreground">{meeting.next_meeting.date ? fmtDay(meeting.next_meeting.date) : "Data a definir"}{meeting.next_meeting.time && <span className="text-primary"> · {meeting.next_meeting.time}</span>}</p>
                        {meeting.next_meeting.agenda && <p className="text-sm text-zinc-300">{meeting.next_meeting.agenda}</p>}
                      </>
                    ) : <p className="text-sm text-muted-foreground">Nenhuma próxima reunião combinada.</p>}
                  </GlassCard>
                  {meeting.next_steps.length > 0 && <GlassCard className="space-y-3"><CardHeader icon={ListChecks} title="Próximos passos" /><Bullets items={meeting.next_steps} /></GlassCard>}
                  {minutes?.decisions?.length ? <GlassCard className="space-y-3"><CardHeader icon={Gavel} title="Decisões" /><Bullets items={minutes.decisions} /></GlassCard> : null}
                  {minutes?.open_questions?.length ? <GlassCard className="space-y-3"><CardHeader icon={HelpCircle} title="Em aberto" /><Bullets items={minutes.open_questions} /></GlassCard> : null}
                  {meeting.ai_model && <p className="px-1 text-xs text-subtle">Ata gerada por {meeting.ai_model} · transcrição gratuita do áudio (Whisper){meeting.type === "lead" ? " · registrada no histórico do lead" : ""}</p>}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tarefas" className="mt-4"><TasksReview meeting={meeting} onApplied={load} /></TabsContent>

          <TabsContent value="pendencias" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {(["nossa", "cliente"] as const).map((side) => {
                const items = meeting.meeting_pending.filter((p) => p.side === side)
                return (
                  <GlassCard key={side} className="space-y-3">
                    <CardHeader title={side === "nossa" ? "Nossa responsabilidade" : "Responsabilidade do cliente"} description={`${items.filter((p) => !p.done).length} em aberto`} />
                    {items.length ? (
                      <ul className="divide-y divide-white/[0.05]">
                        {items.map((p) => (
                          <li key={p.id} className="flex items-start gap-3 py-2.5">
                            <Checkbox checked={p.done} onCheckedChange={() => togglePending(p)} aria-label={`Marcar “${p.description}”`} className="mt-0.5" />
                            <div><p className={cn("text-sm", p.done ? "text-subtle line-through" : "text-foreground")}>{p.description}</p>{p.owner && <p className="text-xs text-subtle">{p.owner}</p>}</div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="py-4 text-sm text-muted-foreground">Nenhuma pendência.</p>}
                  </GlassCard>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="transcricao" className="mt-4">
            <GlassCard className="space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <CardHeader icon={FileText} title="Transcrição" description="Transcrição automática do áudio (Whisper) — falas do seu microfone e dos participantes" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar na transcrição..." aria-label="Buscar na transcrição" className="h-10 sm:max-w-xs" />
              </div>
              {meeting.transcript ? (
                <div className="max-h-[60vh] space-y-1.5 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20 p-4 font-mono text-[13px] leading-relaxed">
                  {transcriptLines.map((line, i) => {
                    const m = line.match(/^\[(\d{2}:\d{2})\] ([^:]+): (.*)$/)
                    return m ? <p key={i}><span className="text-subtle">{m[1]}</span> <span className="font-semibold text-primary">{m[2]}:</span> <span className="text-zinc-300">{m[3]}</span></p> : <p key={i} className="text-zinc-300">{line}</p>
                  })}
                </div>
              ) : <EmptyState icon={FileText} title="Sem transcrição ainda" className="border-white/[0.06]" />}
            </GlassCard>
          </TabsContent>
        </Tabs>

        <AudioModal meetingId={meeting.id} title={meeting.title} open={audioOpen} onOpenChange={setAudioOpen} />
        <VideoModal meetingId={meeting.id} title={meeting.title} open={videoOpen} onOpenChange={setVideoOpen} />
        <Modal size="sm" open={deleting} onOpenChange={setDeleting} title="Excluir reunião?" description="A ata, a transcrição, as sugestões e o áudio serão apagados. Tarefas já criadas continuam no kanban."
          footer={<><Button variant="outline" onClick={() => setDeleting(false)}>Cancelar</Button><Button variant="destructive" onClick={remove}>Excluir reunião</Button></>} />
      </PageContainer>
    </PageLayout>
  )
}
