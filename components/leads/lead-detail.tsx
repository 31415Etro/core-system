"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Activity, Archive, ArchiveRestore, ArrowLeft, ArrowRight, BadgeDollarSign, CalendarClock, Clock3, FileSignature, FileText,
  FolderOpen, History, ListChecks, Loader2, Mail, MessageCircle, MonitorPlay, MoreHorizontal, NotebookPen, Pencil, Phone,
  Target, Video, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { notify } from "@/components/core/notify"
import { DetailItem } from "@/components/core/overlays"
import { PageContainer } from "@/components/core/page-header"
import { phaseLabel, PlannedButton } from "@/components/core/planned-module"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { LeadAvatar, LeadFormModal, setArchived, StageBadge, useStageMove, useTeam } from "@/components/leads/shared"
import { Timeline } from "@/components/leads/timeline"
import { activityMeta, MANUAL_KINDS } from "@/components/leads/utils"
import { LinkedMeetings } from "@/components/meetings/linked-meetings"
import { PageLayout } from "@/components/page-layout"
import { brl } from "@/lib/it-service-data"
import { daysInStage, PIPELINE_STAGES, stageMeta, whatsappLink, type Lead, type LeadActivity } from "@/lib/pipeline"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—")

/** Aba que depende de um módulo de fase futura — diz o que virá, sem simular dados. */
function PhaseTab({ icon, title, phase, text, action }: { icon: LucideIcon; title: string; phase: number; text: string; action?: string }) {
  return (
    <GlassCard>
      <EmptyState icon={icon} title={`${title} — ${phaseLabel(phase)}`} description={text} action={action ? <PlannedButton label={action} phase={phase} variant="outline" size="sm" /> : undefined} className="border-white/[0.06] py-12" />
    </GlassCard>
  )
}

/** Linha da jornada na visão geral (reunião, demo, proposta, pendências). */
function JourneyRow({ icon: Icon, label, phase }: { icon: LucideIcon; label: string; phase: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-subtle"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-300">{label}</p>
        <p className="text-xs text-subtle">Nenhum registro · {phaseLabel(phase)}</p>
      </div>
    </div>
  )
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const leadQ = useApi<{ opportunity: Lead }>(`/api/commercial-opportunities/${id}`)
  const actQ = useApi<{ activities: LeadActivity[] }>(`/api/commercial-opportunities/${id}/activities`)
  const team = useTeam()
  const [lead, setLead] = useState<Lead | null>(null)
  const [extraActs, setExtraActs] = useState<LeadActivity[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [kind, setKind] = useState<LeadActivity["kind"]>("note")
  const [text, setText] = useState("")
  const [posting, setPosting] = useState(false)
  const [tab, setTab] = useState("visao")

  useEffect(() => { if (leadQ.data?.opportunity) setLead(leadQ.data.opportunity) }, [leadQ.data])

  const onChange = (next: Lead) => { setLead(next); actQ.reload() }
  const { requestMove, modals } = useStageMove(onChange)

  const activities = useMemo(() => {
    const base = actQ.data?.activities ?? []
    return [...extraActs.filter((e) => !base.some((b) => b.id === e.id)), ...base].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [actQ.data, extraActs])

  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !lead) return
    setPosting(true)
    try {
      const response = await fetch(`/api/commercial-opportunities/${lead.id}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, description: text }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao registrar atividade")
      setExtraActs((cur) => [payload.activity, ...cur])
      setText("")
      notify.success("Atividade registrada")
    } catch (err) {
      notify.error("Erro ao registrar atividade", err instanceof Error ? err.message : undefined)
    } finally {
      setPosting(false)
    }
  }

  if (leadQ.error) {
    return <PageLayout><PageContainer><ErrorState message={leadQ.error.includes("não encontrado") ? "Lead não encontrado." : "Não foi possível carregar o lead."} onRetry={leadQ.reload} /><Button variant="ghost" asChild><Link href="/leads"><ArrowLeft /> Voltar para leads</Link></Button></PageContainer></PageLayout>
  }
  if (!lead) {
    return <PageLayout><PageContainer><Skeleton className="h-36 rounded-[20px]" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 rounded-[20px] lg:col-span-2" /><Skeleton className="h-64 rounded-[20px]" /></div></PageContainer></PageLayout>
  }

  const meta = stageMeta(lead.stage)
  const funnel = PIPELINE_STAGES.filter((s) => s.id !== "perdido")
  const idx = funnel.findIndex((s) => s.id === meta.id)
  const next = idx >= 0 ? funnel[idx + 1] : undefined
  const owner = lead.assignee?.full_name ?? team.find((m) => m.id === lead.assigned_to)?.full_name ?? null
  const wa = whatsappLink(lead.whatsapp || lead.phone)
  const closed = meta.id === "fechado"

  return (
    <PageLayout>
      <PageContainer>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Leads</Link>

        <GlassCard className="space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <LeadAvatar lead={lead} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight">{lead.company_name}</h1>
                  <StageBadge stage={lead.stage} />
                  {lead.archived_at && <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-subtle">Arquivado</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{[lead.segment, lead.city, lead.contact_name && `Contato: ${lead.contact_name}`].filter(Boolean).join(" · ") || "Sem dados complementares"}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  <span className="text-subtle">Valor estimado <span className="ml-1 font-semibold text-foreground">{brl(Number(lead.estimated_value ?? 0))}</span></span>
                  <span className="text-subtle">Responsável <span className="ml-1 text-zinc-300">{owner ?? "—"}</span></span>
                  <span className="inline-flex items-center gap-1 text-subtle"><Clock3 className="size-3.5" />{daysInStage(lead)} dias na etapa</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setTab("reunioes")}><Video /> Reuniões</Button>
              <PlannedButton label="Criar demo" phase={3} variant="outline" />
              <PlannedButton label="Criar proposta" phase={4} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal /> Mais ações</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Editar lead</DropdownMenuItem>
                  {next && <DropdownMenuItem onSelect={() => requestMove(lead, next.id)}><ArrowRight className="text-primary" /> Avançar para {next.label}</DropdownMenuItem>}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><Target /> Mover para etapa</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      {PIPELINE_STAGES.filter((s) => s.id !== meta.id).map((s) => <DropdownMenuItem key={s.id} onSelect={() => requestMove(lead, s.id)}>{s.label}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {!closed && <DropdownMenuItem onSelect={() => requestMove(lead, "fechado")}><BadgeDollarSign /> Finalizar venda</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {wa && <DropdownMenuItem asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></DropdownMenuItem>}
                  {lead.email && <DropdownMenuItem asChild><a href={`mailto:${lead.email}`}><Mail /> Enviar e-mail</a></DropdownMenuItem>}
                  {lead.phone && <DropdownMenuItem asChild><a href={`tel:${lead.phone.replace(/\D/g, "")}`}><Phone /> Ligar</a></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {lead.archived_at
                    ? <DropdownMenuItem onSelect={() => setArchived(lead, false, onChange)}><ArchiveRestore /> Restaurar</DropdownMenuItem>
                    : <DropdownMenuItem onSelect={() => setArchived(lead, true, onChange)}><Archive /> Arquivar</DropdownMenuItem>}
                  {meta.id !== "perdido" && <DropdownMenuItem variant="destructive" onSelect={() => requestMove(lead, "perdido")}><XCircle /> Marcar como perdido</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <ol className="flex min-w-max items-center gap-1" aria-label="Jornada do lead">
              {funnel.map((s, i) => {
                const done = meta.id !== "perdido" && i < idx
                const current = s.id === meta.id
                return (
                  <li key={s.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => !current && requestMove(lead, s.id)} title={`Mover para ${s.label}`} aria-current={current ? "step" : undefined}
                      className={cn("whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        current ? "border-[var(--core-yellow-border)] bg-core-gradient text-black" : done ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15" : "border-white/[0.07] text-subtle hover:border-white/15 hover:text-muted-foreground")}>
                      {s.id === "fechado" ? "Fechado / Cliente" : s.label}
                    </button>
                    {i < funnel.length - 1 && <span className={cn("h-px w-3", done ? "bg-primary/40" : "bg-white/[0.08]")} />}
                  </li>
                )
              })}
            </ol>
            {meta.id === "perdido" && <p className="mt-2 text-xs text-red-300">Lead perdido{lead.lost_reason ? ` — ${lead.lost_reason}` : ""}.</p>}
          </div>
        </GlassCard>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start" aria-label="Seções do lead">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
            <TabsTrigger value="demo">Demo</TabsTrigger>
            <TabsTrigger value="propostas">Propostas</TabsTrigger>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="pendencias">Pendências</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Visão geral */}
          <TabsContent value="visao" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <GlassCard className="space-y-5">
                  <CardHeader title="Empresa e contato" actions={<Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}><Pencil /> Editar</Button>} />
                  <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="CNPJ">{lead.cnpj || "—"}</DetailItem>
                    <DetailItem label="Segmento">{lead.segment || "—"}</DetailItem>
                    <DetailItem label="Cidade">{lead.city || "—"}</DetailItem>
                    <DetailItem label="Contato principal">{lead.contact_name || "—"}</DetailItem>
                    <DetailItem label="Telefone">{lead.phone || "—"}</DetailItem>
                    <DetailItem label="WhatsApp">{wa ? <a href={wa} target="_blank" rel="noreferrer" className="text-primary hover:underline">{lead.whatsapp || lead.phone}</a> : "—"}</DetailItem>
                    <DetailItem label="E-mail">{lead.email ? <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a> : "—"}</DetailItem>
                    {Boolean(lead.socios?.length) && <div className="sm:col-span-2"><DetailItem label="Sócios">{lead.socios!.join(", ")}</DetailItem></div>}
                  </dl>
                </GlassCard>

                <GlassCard className="space-y-5">
                  <CardHeader icon={Target} title="Resumo comercial" />
                  <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Etapa"><StageBadge stage={lead.stage} /></DetailItem>
                    <DetailItem label="Valor estimado">{brl(Number(lead.estimated_value ?? 0))}</DetailItem>
                    <DetailItem label="Responsável">{owner || "—"}</DetailItem>
                    <DetailItem label="Origem">{lead.source || "—"}</DetailItem>
                    <DetailItem label="Criado em">{fmtDate(lead.created_at)}</DetailItem>
                    <DetailItem label="Na etapa há">{daysInStage(lead)} dias</DetailItem>
                  </dl>
                  {lead.notes && <div className="border-t border-white/[0.06] pt-4"><p className="mb-1.5 text-xs text-subtle">Observações</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{lead.notes}</p></div>}
                </GlassCard>
              </div>

              <div className="space-y-4">
                <GlassCard highlight={Boolean(lead.next_action || lead.next_action_at)} className="space-y-3">
                  <CardHeader icon={CalendarClock} title="Próxima ação" />
                  {lead.next_action || lead.next_action_at ? (
                    <div><p className="text-sm font-medium text-foreground">{lead.next_action || "Ação agendada"}</p><p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(lead.next_action_at)}</p></div>
                  ) : <p className="text-sm text-muted-foreground">Nenhuma ação agendada.</p>}
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{lead.next_action ? "Alterar" : "Agendar"}</Button>
                </GlassCard>
                <GlassCard className="space-y-1">
                  <CardHeader title="Jornada" description="Demo e proposta do lead" className="mb-2" />
                  <div className="divide-y divide-white/[0.05]">
                    <JourneyRow icon={MonitorPlay} label="Demo" phase={3} />
                    <JourneyRow icon={FileText} label="Última proposta" phase={4} />
                  </div>
                </GlassCard>
                <GlassCard className="space-y-3">
                  <CardHeader icon={Activity} title="Linha do tempo" actions={<Button variant="ghost" size="sm" onClick={() => setTab("historico")}>Ver tudo</Button>} />
                  <Timeline items={activities.slice(0, 4)} loading={actQ.loading} empty="Nenhuma atividade ainda" />
                </GlassCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reunioes" className="mt-4"><LinkedMeetings leadId={lead.id} view="reunioes" /></TabsContent>
          <TabsContent value="demo" className="mt-4"><PhaseTab icon={MonitorPlay} title="Demo" phase={3} action="Criar demo" text="Demos ligadas ao lead: status, URL e data, com Abrir demo, Gerenciar e Converter em produção." /></TabsContent>
          <TabsContent value="propostas" className="mt-4"><PhaseTab icon={FileText} title="Propostas" phase={4} action="Criar proposta" text="Propostas do lead com status, implantação e mensalidade. Da proposta aceita sai o contrato, sem redigitar valores." /></TabsContent>
          <TabsContent value="contrato" className="mt-4"><PhaseTab icon={FileSignature} title="Contrato" phase={4} text="Contrato gerado a partir da proposta, com status até a assinatura. Assinado, ele finaliza a venda: cliente, projeto e financeiro." /></TabsContent>
          <TabsContent value="tarefas" className="mt-4"><LinkedMeetings leadId={lead.id} view="tarefas" /></TabsContent>
          <TabsContent value="pendencias" className="mt-4"><LinkedMeetings leadId={lead.id} view="pendencias" /></TabsContent>
          <TabsContent value="arquivos" className="mt-4"><PhaseTab icon={FolderOpen} title="Arquivos" phase={2} text="Arquivos do lead, gravações de reunião e documentos enviados pelo cliente." /></TabsContent>

          {/* Financeiro: venda registrada no próprio lead */}
          <TabsContent value="financeiro" className="mt-4">
            {closed && (lead.closed_value != null || lead.monthly_value != null) ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <GlassCard highlight><p className="text-sm text-muted-foreground">Entrada / implantação</p><p className="mt-2 text-2xl font-semibold tabular-nums">{brl(Number(lead.closed_value ?? 0))}</p></GlassCard>
                  <GlassCard><p className="text-sm text-muted-foreground">Mensalidade</p><p className="mt-2 text-2xl font-semibold tabular-nums">{lead.monthly_value ? `${brl(Number(lead.monthly_value))}/mês` : "—"}</p></GlassCard>
                  <GlassCard><p className="text-sm text-muted-foreground">Fechado em</p><p className="mt-2 text-2xl font-semibold tabular-nums">{fmtDate(lead.closed_at)}</p></GlassCard>
                </div>
                <p className="text-xs text-subtle">Parcelas pendentes, pagas e atrasadas e o contrato relacionado aparecem aqui quando a venda gerar o financeiro automaticamente ({phaseLabel(4)}).</p>
              </div>
            ) : (
              <GlassCard>
                <EmptyState icon={BadgeDollarSign} title="Nenhuma venda registrada" description="Ao finalizar a venda, a implantação e a mensalidade ficam registradas aqui." action={meta.id !== "perdido" ? <Button size="sm" onClick={() => requestMove(lead, "fechado")}><BadgeDollarSign /> Finalizar venda</Button> : undefined} className="border-white/[0.06] py-12" />
              </GlassCard>
            )}
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <GlassCard>
                <form onSubmit={addActivity} className="space-y-3">
                  <CardHeader icon={NotebookPen} title="Registrar atividade" description="Ligações, mensagens, e-mails, reuniões ou notas." />
                  <Select value={kind} onValueChange={(v) => setKind(v as LeadActivity["kind"])}>
                    <SelectTrigger className="w-full" aria-label="Tipo de atividade"><SelectValue /></SelectTrigger>
                    <SelectContent>{MANUAL_KINDS.map((k) => <SelectItem key={k} value={k}>{activityMeta[k].label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="O que aconteceu?" aria-label="Descrição da atividade" className="min-h-28" />
                  <Button type="submit" className="w-full" disabled={posting || !text.trim()}>{posting && <Loader2 className="animate-spin" />}Registrar</Button>
                </form>
              </GlassCard>
              <GlassCard className="space-y-4">
                <CardHeader icon={History} title="Histórico" description="Atividades, mudanças de etapa, venda e alterações" />
                {actQ.error ? <ErrorState message="Não foi possível carregar o histórico." onRetry={actQ.reload} /> : <Timeline items={activities} loading={actQ.loading} empty="Sem histórico registrado" />}
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>

        {modals}
        <LeadFormModal open={editOpen} onOpenChange={setEditOpen} lead={lead} team={team} onSaved={(saved) => onChange({ ...lead, ...saved })} />
      </PageContainer>
    </PageLayout>
  )
}
