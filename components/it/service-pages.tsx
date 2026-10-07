"use client"
import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Headphones, type LucideIcon } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { MetricCard } from "@/components/core/metric-card"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { MetricSkeleton } from "@/components/core/states"
import { TicketKanban } from "@/components/it/task-kanban"

function Shell({ title, description, children, actions }:{title:string;description:string;children:React.ReactNode;actions?:React.ReactNode}) { return <PageLayout><PageContainer><PageHeader title={title} description={description} actions={actions} />{children}</PageContainer></PageLayout> }
function Metric({label,value,note,icon}:{label:string;value:string|number;note:string;icon:LucideIcon}) { return <MetricCard icon={icon} label={label} value={value} note={note} /> }
const MetricsLoading = () => <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <MetricSkeleton key={i} />)}</div>

type Task = { kind: "tarefa" | "chamado"; priority: "baixa" | "media" | "alta"; status: string; completed_at: string | null }

export function TicketsIT() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  useEffect(() => { fetch("/api/tasks").then(r => r.json()).then(p => setTasks(p.tasks ?? [])).catch(() => setTasks([])) }, [])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const abertos = tasks?.filter(t => t.kind === "chamado" && t.status !== "concluido").length ?? 0
  const prioridadeAlta = tasks?.filter(t => t.priority === "alta" && t.status !== "concluido").length ?? 0
  const concluidosNoMes = tasks?.filter(t => t.status === "concluido" && t.completed_at?.startsWith(thisMonth)).length ?? 0

  return <Shell title="Tarefas e chamados" description="Acompanhe prioridade, prazo, responsável e resolução de cada tarefa ou chamado.">
    {tasks === null ? <MetricsLoading /> : (
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Chamados abertos" value={abertos} note="Ainda não concluídos" icon={Headphones} />
        <Metric label="Prioridade alta" value={prioridadeAlta} note="Tarefas e chamados em aberto" icon={AlertTriangle} />
        <Metric label="Concluídos no mês" value={concluidosNoMes} note="Referência do mês atual" icon={CheckCircle2} />
      </div>
    )}
    <TicketKanban />
  </Shell>
}
