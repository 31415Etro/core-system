"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleDollarSign, Filter, Plus, Target, TrendingUp, Upload, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SelectField } from "@/components/core/form-fields"
import { MetricCard } from "@/components/core/metric-card"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { ErrorState } from "@/components/core/states"
import { ActivitiesView } from "@/components/leads/activities-view"
import { ImportLeadsModal } from "@/components/leads/import-modal"
import { ListView } from "@/components/leads/list-view"
import { PipelineView } from "@/components/leads/pipeline-view"
import { ProspectingView } from "@/components/leads/prospecting-view"
import { LeadFormModal, setArchived, useStageMove, useTeam } from "@/components/leads/shared"
import { PageLayout } from "@/components/page-layout"
import { isLostStage, isOpenStage, isWonStage, LEAD_SEGMENTS, LEAD_SOURCES, type Lead } from "@/lib/pipeline"
import { useApi } from "@/lib/use-api"
import { useQueryParam } from "@/lib/use-query-param"

const TABS = ["pipeline", "lista", "prospeccao", "atividades"] as const
type Tab = (typeof TABS)[number]
const ALL = "all"
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

/** Leads: centro do processo comercial. Pipeline, lista, prospecção e atividades são abas — não páginas da sidebar. */
export function LeadsHub() {
  const router = useRouter()
  const { data, loading, error, reload } = useApi<{ opportunities: Lead[] }>("/api/commercial-opportunities")
  const team = useTeam()
  const [tab, setTab] = useState<Tab>("pipeline")
  const [local, setLocal] = useState<Record<string, Lead>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [owner, setOwner] = useState(ALL)
  const [source, setSource] = useState(ALL)
  const [segment, setSegment] = useState(ALL)

  useQueryParam("aba", (v) => setTab((TABS as readonly string[]).includes(v) ? (v as Tab) : "pipeline"), { keep: true })
  useQueryParam("novo", () => { setEditing(null); setFormOpen(true) })

  const upsert = (lead: Lead) => setLocal((cur) => ({ ...cur, [lead.id]: lead }))
  const { requestMove, modals } = useStageMove(upsert)

  const leads = useMemo(() => {
    const base = data?.opportunities ?? []
    const merged = base.map((l) => local[l.id] ?? l)
    const extra = Object.values(local).filter((l) => !base.some((b) => b.id === l.id))
    return [...extra, ...merged]
  }, [data, local])

  const filtered = leads.filter((l) =>
    (owner === ALL || (owner === "none" ? !l.assigned_to : l.assigned_to === owner)) &&
    (source === ALL || l.source === source) &&
    (segment === ALL || l.segment === segment))
  const active = filtered.filter((l) => !l.archived_at)
  const activeFilters = [owner, source, segment].filter((f) => f !== ALL).length

  const ownerName = (l: Lead) => l.assignee?.full_name ?? team.find((m) => m.id === l.assigned_to)?.full_name ?? null
  const open = active.filter((l) => isOpenStage(l.stage))
  const won = active.filter((l) => isWonStage(l.stage)).length
  const lost = active.filter((l) => isLostStage(l.stage)).length
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  function changeTab(next: string) {
    setTab(next as Tab)
    router.replace(`/leads?aba=${next}`, { scroll: false })
  }

  const newLead = () => { setEditing(null); setFormOpen(true) }

  return (
    <PageLayout>
      <PageContainer className="max-w-none">
        <PageHeader
          title="Leads"
          description="Gerencie todas as oportunidades comerciais."
          actions={<>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-label={activeFilters ? `Filtros (${activeFilters} ativos)` : "Filtros"}>
                  <Filter /> Filtros
                  {activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-core-gradient text-[11px] font-bold text-black">{activeFilters}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Filtros</p>
                  {activeFilters > 0 && <button type="button" onClick={() => { setOwner(ALL); setSource(ALL); setSegment(ALL) }} className="inline-flex items-center gap-1 text-xs text-primary"><X className="size-3" /> Limpar</button>}
                </div>
                <SelectField label="Responsável" value={owner} onValueChange={setOwner} options={[{ value: ALL, label: "Todos" }, { value: "none", label: "Sem responsável" }, ...team.map((m) => ({ value: m.id, label: m.full_name }))]} />
                <SelectField label="Origem" value={source} onValueChange={setSource} options={[{ value: ALL, label: "Todas" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]} />
                <SelectField label="Segmento" value={segment} onValueChange={setSegment} options={[{ value: ALL, label: "Todos" }, ...LEAD_SEGMENTS.map((s) => ({ value: s, label: s }))]} />
                <p className="text-xs text-subtle">Valem para Pipeline, Lista e Prospecção.</p>
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Importar</Button>
            <Button onClick={newLead}><Plus /> Novo lead</Button>
          </>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Target} label="Leads em aberto" value={open.length} note={`${active.length} no total`} loading={loading} />
          <MetricCard icon={CircleDollarSign} label="Valor em negociação" value={brl0(open.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0))} note="Soma dos valores estimados" loading={loading} />
          <MetricCard icon={UserPlus} label="Novos este mês" value={active.filter((l) => l.created_at >= monthStart).length} note="Leads criados no mês" loading={loading} />
          <MetricCard icon={TrendingUp} label="Conversão" value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"} note={`${won} fechados · ${lost} perdidos`} loading={loading} />
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList aria-label="Seções de Leads">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="prospeccao">Prospecção</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
          </TabsList>

          {error && tab !== "atividades" ? <div className="mt-4"><ErrorState message="Não foi possível carregar os leads." onRetry={reload} /></div> : <>
            <TabsContent value="pipeline" className="mt-4">
              <PipelineView leads={active} loading={loading} ownerName={ownerName} onMove={requestMove} />
            </TabsContent>
            <TabsContent value="lista" className="mt-4">
              <ListView leads={filtered} loading={loading} ownerName={ownerName} onEdit={(l) => { setEditing(l); setFormOpen(true) }} onArchive={(l, a) => setArchived(l, a, upsert)} emptyAction={<Button size="sm" onClick={newLead}><Plus /> Criar primeiro lead</Button>} />
            </TabsContent>
            <TabsContent value="prospeccao" className="mt-4">
              <ProspectingView leads={filtered} loading={loading} ownerName={ownerName} onChange={upsert} />
            </TabsContent>
          </>}
          <TabsContent value="atividades" className="mt-4">
            <ActivitiesView />
          </TabsContent>
        </Tabs>

        {modals}
        <LeadFormModal open={formOpen} onOpenChange={setFormOpen} lead={editing} team={team} onSaved={(lead) => { upsert({ ...(editing ?? {}), ...lead } as Lead); if (!editing) router.push(`/leads/${lead.id}`) }} />
        <ImportLeadsModal open={importOpen} onOpenChange={setImportOpen} onImported={() => { reload(); setLocal({}) }} />
      </PageContainer>
    </PageLayout>
  )
}
