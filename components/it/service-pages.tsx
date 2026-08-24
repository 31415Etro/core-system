"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Headphones, Loader2, TrendingUp } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { brl } from "@/lib/it-service-data"
import { TicketKanban } from "@/components/it/task-kanban"
import { CommercialKanban } from "@/components/commercial/commercial-kanban"
const ProspectMap = dynamic(() => import("@/components/commercial/prospect-map").then(m => m.ProspectMap), { ssr: false })

function Shell({ title, description, children, actions }:{title:string;description:string;children:React.ReactNode;actions?:React.ReactNode}) { return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{actions}</header>{children}</div></PageLayout> }
function Metric({label,value,note,icon:Icon}:{label:string;value:string|number;note:string;icon:any}) { return <div className="border-l-2 border-primary bg-card px-5 py-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div> }

type Task = { kind: "tarefa" | "chamado"; priority: "baixa" | "media" | "alta"; status: string; completed_at: string | null }

export function TicketsIT() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  useEffect(() => { fetch("/api/tasks").then(r => r.json()).then(p => setTasks(p.tasks ?? [])).catch(() => setTasks([])) }, [])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const abertos = tasks?.filter(t => t.kind === "chamado" && t.status !== "concluido").length ?? 0
  const prioridadeAlta = tasks?.filter(t => t.priority === "alta" && t.status !== "concluido").length ?? 0
  const concluidosNoMes = tasks?.filter(t => t.status === "concluido" && t.completed_at?.startsWith(thisMonth)).length ?? 0

  return <Shell title="Tarefas e chamados" description="Acompanhe prioridade, prazo, responsável e resolução de cada tarefa ou chamado.">
    {tasks === null ? <div className="grid min-h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Chamados abertos" value={abertos} note="Ainda não concluídos" icon={Headphones} />
        <Metric label="Prioridade alta" value={prioridadeAlta} note="Tarefas e chamados em aberto" icon={AlertTriangle} />
        <Metric label="Concluídos no mês" value={concluidosNoMes} note="Referência do mês atual" icon={CheckCircle2} />
      </div>
    )}
    <TicketKanban />
  </Shell>
}

type Opportunity = { stage: string; estimated_value: number }

export function CommercialIT() {
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null)
  useEffect(() => { fetch("/api/commercial-opportunities").then(r => r.json()).then(p => setOpportunities(p.opportunities ?? [])).catch(() => setOpportunities([])) }, [])

  const abertas = opportunities?.filter(o => o.stage !== "ganho" && o.stage !== "perdido") ?? []
  const pipelineAberto = abertas.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0)
  const propostasEnviadas = opportunities?.filter(o => o.stage === "proposta" || o.stage === "negociacao").length ?? 0
  const ganhos = opportunities?.filter(o => o.stage === "ganho").length ?? 0
  const perdidos = opportunities?.filter(o => o.stage === "perdido").length ?? 0
  const conversao = ganhos + perdidos > 0 ? Math.round((ganhos / (ganhos + perdidos)) * 100) : null

  return <Shell title="Comercial" description="Prospecção e negociação de contratos recorrentes de infraestrutura e suporte.">
    {opportunities === null ? <div className="grid min-h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Pipeline aberto" value={brl(pipelineAberto)} note={`${abertas.length} oportunidades ativas`} icon={BriefcaseBusiness} />
        <Metric label="Propostas/negociações" value={propostasEnviadas} note="Em proposta ou negociação" icon={CircleDollarSign} />
        <Metric label="Conversão" value={conversao === null ? "—" : `${conversao}%`} note="Ganhos sobre fechados (ganho + perdido)" icon={TrendingUp} />
      </div>
    )}
    <Tabs defaultValue="kanban"><TabsList><TabsTrigger value="kanban">Pipeline</TabsTrigger><TabsTrigger value="mapa">Mapa de prospecção</TabsTrigger></TabsList><TabsContent value="kanban"><CommercialKanban /></TabsContent><TabsContent value="mapa"><h2 className="mb-3 text-lg font-semibold">Prospecção por CNAE (Santa Catarina)</h2><ProspectMap /></TabsContent></Tabs>
  </Shell>
}
