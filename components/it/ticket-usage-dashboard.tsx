"use client"
import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, Building2, CircleDollarSign, Loader2, TicketCheck } from "lucide-react"
import { brl } from "@/lib/it-service-data"
import { createClient } from "@/lib/supabase/client"

type Task = {
  id: string; kind: "tarefa" | "chamado"; os_number: string | null; company_name: string | null
  priority: "baixa" | "media" | "alta"; status: string; created_at: string; completed_at: string | null
}
type Client = { id: string; name: string }
type Opportunity = { id: string; stage: string; estimated_value: number }
type ClientFinancial = { has_maintenance: boolean; maintenance_monthly_value: number | null }

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof TicketCheck }) {
  return <div className="border-l-2 border-primary bg-card px-5 py-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>
}

const statusLabel: Record<string, string> = { triagem: "Triagem", a_fazer: "A fazer", em_andamento: "Em andamento", aguardando_cliente: "Aguardando cliente", concluido: "Concluído" }

export function TicketUsageDashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [financials, setFinancials] = useState<ClientFinancial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [tasksPayload, clientsPayload, opportunitiesPayload, financialsResult] = await Promise.all([
        fetch("/api/tasks").then(r => r.json()).catch(() => ({ tasks: [] })),
        fetch("/api/clients").then(r => r.json()).catch(() => ({ clients: [] })),
        fetch("/api/commercial-opportunities").then(r => r.json()).catch(() => ({ opportunities: [] })),
        supabase.from("client_financials").select("has_maintenance, maintenance_monthly_value"),
      ])
      if (cancelled) return
      setTasks(tasksPayload.tasks ?? [])
      setClients(clientsPayload.clients ?? [])
      setOpportunities(opportunitiesPayload.opportunities ?? [])
      setFinancials(financialsResult.data ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const openTickets = tasks.filter(t => t.kind === "chamado" && t.status !== "concluido")
  const highPriorityOpen = tasks.filter(t => t.priority === "alta" && t.status !== "concluido")
  const maintenanceRevenue = financials.filter(f => f.has_maintenance).reduce((sum, f) => sum + (f.maintenance_monthly_value ?? 0), 0)
  const openPipeline = opportunities.filter(o => o.stage !== "ganho" && o.stage !== "perdido").reduce((sum, o) => sum + (o.estimated_value ?? 0), 0)

  const dailyChart = useMemo(() => {
    const days: { date: string; label: string; Abertas: number; Concluídas: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Abertas: 0, Concluídas: 0 })
    }
    const byDate = new Map(days.map(d => [d.date, d]))
    for (const task of tasks) {
      const createdKey = task.created_at?.slice(0, 10)
      if (createdKey && byDate.has(createdKey)) byDate.get(createdKey)!.Abertas += 1
      const completedKey = task.completed_at?.slice(0, 10)
      if (completedKey && byDate.has(completedKey)) byDate.get(completedKey)!.Concluídas += 1
    }
    return days
  }, [tasks])

  const recentTickets = useMemo(
    () => tasks.filter(t => t.kind === "chamado").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [tasks],
  )

  if (loading) return <div className="grid min-h-[300px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Clientes ativos" value={clients.length} note="Cadastrados no sistema" icon={Building2} />
      <Metric label="Chamados abertos" value={openTickets.length} note="Ainda não concluídos" icon={TicketCheck} />
      <Metric label="Prioridade alta em aberto" value={highPriorityOpen.length} note="Tarefas e chamados" icon={AlertTriangle} />
      <Metric label="Receita recorrente de manutenção" value={brl(maintenanceRevenue)} note="Soma dos contratos de manutenção ativos" icon={CircleDollarSign} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_.55fr]">
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-5"><h2 className="font-semibold">Tarefas e chamados — últimos 14 dias</h2><p className="text-xs text-muted-foreground">Abertas vs. concluídas por dia</p></div>
        <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyChart} margin={{ left: -24, right: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} /><Tooltip /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Abertas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={24} /><Bar dataKey="Concluídas" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4, 4, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-xl border bg-card">
        <div className="border-b p-5"><h2 className="font-semibold">Chamados recentes</h2><p className="text-xs text-muted-foreground">Últimos abertos, de qualquer origem</p></div>
        <div className="divide-y">
          {recentTickets.length ? recentTickets.map(t => <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{t.os_number} · {t.company_name}</p><p className="text-xs text-muted-foreground">{statusLabel[t.status] ?? t.status}</p></div><span className={`rounded-md px-2 py-1 text-xs font-semibold ${t.priority === "alta" ? "bg-red-50 text-red-700" : "bg-muted"}`}>{t.priority === "alta" ? "Alta" : t.priority === "media" ? "Média" : "Baixa"}</span></div>) : <p className="p-5 text-sm text-muted-foreground">Nenhum chamado ainda.</p>}
        </div>
      </section>
    </div>
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-1"><h2 className="font-semibold">Pipeline comercial em aberto</h2><p className="text-xs text-muted-foreground">Oportunidades que ainda não foram ganhas ou perdidas</p></div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-primary">{brl(openPipeline)}</p>
    </section>
  </div>
}
