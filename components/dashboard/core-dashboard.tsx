"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, CalendarRange, CheckCircle2, CircleDollarSign, ListChecks, Ticket, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardHeader, CardLink, GlassCard } from "@/components/core/glass-card"
import { MetricCard } from "@/components/core/metric-card"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { DataTable, type DataTableColumn } from "@/components/core/data-table"
import { PriorityBadge, TaskStatusBadge } from "@/components/core/status-badge"
import { ChartSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { isOpen, isOverdue, relativeTime, type ApiClient, type ApiOpportunity, type ApiTask, type ApiTransaction } from "@/components/core/api-types"
import { AgendaCard } from "@/components/dashboard/agenda-card"
import { TaskDrawer } from "@/components/dashboard/task-drawer"
import { useAuth } from "@/lib/auth-context"
import { isOpenStage } from "@/lib/pipeline"
import { brl } from "@/lib/it-service-data"
import { createClient } from "@/lib/supabase/client"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Recharts só é carregado no cliente e depois do primeiro paint.
const PerformanceChart = dynamic(() => import("./dashboard-charts").then((m) => m.PerformanceChart), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-xl" /> })
const MonthlyBarsChart = dynamic(() => import("./dashboard-charts").then((m) => m.MonthlyBarsChart), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-xl" /> })
const ProgressDonut = dynamic(() => import("./dashboard-charts").then((m) => m.ProgressDonut), { ssr: false, loading: () => <Skeleton className="size-[148px] rounded-full" /> })

/* ---------- datas ---------- */
const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localDay = (value: string) => (value.length === 10 ? value : iso(new Date(value)))
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5) + 1

type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "custom"
type Range = { from: string; to: string }
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
]

function rangeFor(key: PeriodKey, custom: Range): Range {
  const now = new Date()
  const to = iso(now)
  if (key === "hoje") return { from: to, to }
  if (key === "7d") return { from: iso(addDays(now, -6)), to }
  if (key === "30d") return { from: iso(addDays(now, -29)), to }
  if (key === "mes") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  return custom
}

function previousRange(r: Range): Range {
  const len = daysBetween(r.from, r.to)
  const prevTo = addDays(new Date(`${r.from}T12:00:00`), -1)
  return { from: iso(addDays(prevTo, -(len - 1))), to: iso(prevTo) }
}

const inRange = (day: string, r: Range) => day >= r.from && day <= r.to
const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

/** Divide o período em 7 fatias para o mini gráfico dos KPIs. */
function buckets<T>(items: T[], dayOf: (t: T) => string, weight: (t: T) => number, r: Range) {
  const len = daysBetween(r.from, r.to)
  const size = Math.max(1, Math.ceil(len / 7))
  const out = Array(Math.min(7, len)).fill(0)
  for (const it of items) {
    const d = dayOf(it)
    if (!inRange(d, r)) continue
    const idx = Math.min(out.length - 1, Math.floor((daysBetween(r.from, d) - 1) / size))
    out[idx] += weight(it)
  }
  return out
}

function lastMonths(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").replace(/^./, (c) => c.toUpperCase()) }
  })
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}

/* ---------- atividade recente ---------- */
type ActivityItem = { id: string; at: string; title: string; detail: string; icon: typeof Ticket; tone: string; task?: ApiTask }

function buildActivity(tasks: ApiTask[], txs: ApiTransaction[]): ActivityItem[] {
  const list: ActivityItem[] = []
  for (const t of tasks) {
    list.push({ id: `c-${t.id}`, at: t.created_at, title: t.kind === "chamado" ? "Novo chamado aberto" : "Nova tarefa criada", detail: [t.os_number, t.title, t.company_name].filter(Boolean).join(" · "), icon: Ticket, tone: "bg-primary/10 text-primary border-primary/20", task: t })
    if (t.completed_at) list.push({ id: `d-${t.id}`, at: t.completed_at, title: t.kind === "chamado" ? "Chamado concluído" : "Tarefa concluída", detail: [t.os_number, t.title].filter(Boolean).join(" · "), icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", task: t })
  }
  for (const x of txs) {
    const income = x.type === "income"
    list.push({ id: `f-${x.id}`, at: `${x.transaction_date}T12:00:00`, title: `${income ? "Entrada" : "Saída"} de ${brl(Number(x.amount))}${x.status === "pending" ? " (pendente)" : ""}`, detail: x.description, icon: income ? ArrowDownLeft : ArrowUpRight, tone: income ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/[0.05] text-zinc-300 border-white/10" })
  }
  return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
}

/* ---------- componente ---------- */
export function CoreDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodKey>("30d")
  const [custom, setCustom] = useState<Range>(() => ({ from: iso(addDays(new Date(), -29)), to: iso(new Date()) }))
  const [perfMonths, setPerfMonths] = useState<"6" | "12">("12")
  const [openTask, setOpenTask] = useState<ApiTask | null>(null)

  const range = rangeFor(period, custom)
  const prev = previousRange(range)

  // Uma busca cobre gráficos (12 meses) e comparação de períodos; amplia se o personalizado for mais antigo.
  const baseFrom = iso(new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1))
  const txFrom = prev.from < baseFrom ? prev.from : baseFrom

  const tasksQ = useApi<{ tasks: ApiTask[] }>("/api/tasks")
  const clientsQ = useApi<{ clients: ApiClient[] }>("/api/clients")
  const oppsQ = useApi<{ opportunities: ApiOpportunity[] }>("/api/commercial-opportunities")
  const txQ = useApi<{ transactions: ApiTransaction[] }>(`/api/financial-transactions?from=${txFrom}&to=${iso(new Date())}`)
  const [maintenance, setMaintenance] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    type Row = { has_maintenance: boolean; maintenance_monthly_value: number | null }
    try {
      createClient().from("client_financials").select("has_maintenance, maintenance_monthly_value").then(({ data }: { data: Row[] | null }) => {
        if (cancelled) return
        setMaintenance((data ?? []).filter((f) => f.has_maintenance).reduce((s, f) => s + (f.maintenance_monthly_value ?? 0), 0))
      })
    } catch {
      // Supabase não configurado (ambiente local sem .env): o KPI mostra o texto padrão.
    }
    return () => { cancelled = true }
  }, [])

  const tasks = tasksQ.data?.tasks ?? []
  const clients = clientsQ.data?.clients ?? []
  const opps = oppsQ.data?.opportunities ?? []
  const txs = useMemo(() => (txQ.data?.transactions ?? []).map((t) => ({ ...t, amount: Number(t.amount) })), [txQ.data])

  /* KPIs */
  const kpis = useMemo(() => {
    const incomes = txs.filter((t) => t.type === "income")
    const revenue = (r: Range) => incomes.filter((t) => inRange(t.transaction_date, r)).reduce((s, t) => s + t.amount, 0)
    const tickets = tasks.filter((t) => t.kind === "chamado")
    const created = (r: Range) => tickets.filter((t) => inRange(localDay(t.created_at), r)).length
    const openTickets = tickets.filter(isOpen).length
    const highOpen = tasks.filter((t) => isOpen(t) && t.priority === "alta").length
    const activeOpps = opps.filter((o) => isOpenStage(o.stage))
    return {
      revenue: revenue(range),
      revenueDelta: pct(revenue(range), revenue(prev)),
      revenueSpark: buckets(incomes, (t) => t.transaction_date, (t) => t.amount, range),
      openTickets,
      highOpen,
      createdNow: created(range),
      ticketsDelta: pct(created(range), created(prev)),
      ticketsSpark: buckets(tickets, (t) => localDay(t.created_at), () => 1, range),
      pipeline: activeOpps.reduce((s, o) => s + (o.estimated_value ?? 0), 0),
      activeOpps: activeOpps.length,
    }
  }, [txs, tasks, opps, range.from, range.to, prev.from, prev.to]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Desempenho mensal */
  const performance = useMemo(() => {
    const months = lastMonths(Number(perfMonths))
    const map = new Map(months.map((m) => [m.key, { label: m.label, Receita: 0, Despesas: 0, Saldo: 0 }]))
    for (const t of txs) {
      const row = map.get(t.transaction_date.slice(0, 7))
      if (!row) continue
      if (t.type === "income") row.Receita += t.amount
      else row.Despesas += t.amount
    }
    const rows = [...map.values()].map((r) => ({ ...r, Saldo: r.Receita - r.Despesas }))
    const total = rows.reduce((s, r) => s + r.Receita, 0)
    return { rows, total, hasData: rows.some((r) => r.Receita || r.Despesas) }
  }, [txs, perfMonths])

  /* Demanda mensal (tarefas + chamados criados) */
  const demand = useMemo(() => {
    const months = lastMonths(12)
    const map = new Map(months.map((m) => [m.key, { label: m.label, total: 0 }]))
    for (const t of tasks) { const row = map.get(localDay(t.created_at).slice(0, 7)); if (row) row.total += 1 }
    const rows = [...map.values()]
    return { rows, current: rows[rows.length - 1]?.total ?? 0, hasData: rows.some((r) => r.total) }
  }, [tasks])

  /* Progresso */
  const progress = useMemo(() => {
    const done = tasks.filter((t) => t.status === "concluido").length
    const doing = tasks.filter((t) => t.status === "em_andamento").length
    const pending = tasks.length - done - doing
    const overdue = tasks.filter(isOverdue).length
    const total = tasks.length || 1
    return {
      percent: Math.round((done / total) * 100),
      rows: [
        { name: "Concluídas", value: done, color: "#22c55e" },
        { name: "Em andamento", value: doing, color: "#ffc400" },
        { name: "Pendentes", value: pending, color: "#71717a" },
      ],
      overdue,
      total: tasks.length,
    }
  }, [tasks])

  const activity = useMemo(() => buildActivity(tasks, txs), [tasks, txs])
  const recent = useMemo(() => tasks.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30), [tasks])

  const columns: DataTableColumn<ApiTask>[] = [
    { id: "titulo", header: "Tarefa / chamado", value: (t) => t.title, cell: (t) => (
      <div className="min-w-0 max-w-[280px]">
        <p className="truncate font-medium text-foreground">{t.title || "Sem título"}</p>
        <p className="truncate text-xs text-subtle">{[t.os_number, t.kind === "chamado" ? "Chamado" : "Tarefa"].filter(Boolean).join(" · ")}</p>
      </div>
    ) },
    { id: "cliente", header: "Cliente", value: (t) => t.company_name ?? "", cell: (t) => <span className="text-zinc-300">{t.company_name || "—"}</span> },
    { id: "prioridade", header: "Prioridade", value: (t) => ({ alta: 3, media: 2, baixa: 1 })[t.priority] ?? 0, cell: (t) => <PriorityBadge priority={t.priority} /> },
    { id: "status", header: "Status", value: (t) => t.status, cell: (t) => <TaskStatusBadge status={t.status} /> },
    { id: "prazo", header: "Prazo", value: (t) => t.due_date ?? "", cell: (t) => t.due_date ? <span className={cn("tabular-nums", isOverdue(t) ? "text-red-400" : "text-zinc-300")}>{new Date(`${t.due_date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</span> : <span className="text-subtle">—</span> },
    { id: "abertura", header: "Abertura", align: "right", value: (t) => t.created_at, cell: (t) => <span className="text-subtle">{new Date(t.created_at).toLocaleDateString("pt-BR")}</span> },
  ]

  const loadingCore = tasksQ.loading || txQ.loading
  const firstName = user?.name?.split(" ")[0] ?? ""
  const periodLabel = period === "custom" ? `${new Date(`${custom.from}T12:00:00`).toLocaleDateString("pt-BR")} – ${new Date(`${custom.to}T12:00:00`).toLocaleDateString("pt-BR")}` : PERIODS.find((p) => p.key === period)!.label.toLowerCase()
  const vsLabel = period === "hoje" ? "vs. ontem" : "vs. período anterior"

  return (
    <PageContainer>
      <PageHeader
        title={<>{greeting()}{firstName && <>, <span className="text-core-gradient">{firstName}</span></>}.</>}
        description="Acompanhe os principais indicadores da sua operação."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <TabsList aria-label="Período">
                {PERIODS.filter((p) => p.key !== "custom").map((p) => <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Popover>
              <PopoverTrigger className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", period === "custom" ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-border bg-white/[0.04] text-muted-foreground hover:text-foreground")}>
                <CalendarRange className={cn("size-4", period === "custom" && "text-primary")} />
                {period === "custom" ? periodLabel : "Personalizado"}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <p className="text-sm font-semibold">Período personalizado</p>
                <label className="block space-y-1.5 text-xs text-muted-foreground">De<Input type="date" value={custom.from} max={custom.to} onChange={(e) => { setCustom((c) => ({ ...c, from: e.target.value })); setPeriod("custom") }} /></label>
                <label className="block space-y-1.5 text-xs text-muted-foreground">Até<Input type="date" value={custom.to} min={custom.from} max={iso(new Date())} onChange={(e) => { setCustom((c) => ({ ...c, to: e.target.value })); setPeriod("custom") }} /></label>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {/* Linha 1 — KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CircleDollarSign}
          label="Receita no período"
          value={brl0(kpis.revenue)}
          delta={kpis.revenueDelta}
          note={kpis.revenueDelta === null ? `Entradas · ${periodLabel}` : vsLabel}
          spark={kpis.revenueSpark}
          loading={txQ.loading}
          menu={[{ label: "Abrir financeiro", onSelect: () => router.push("/financeiro") }, { label: "Nova movimentação", onSelect: () => router.push("/financeiro?novo=1") }]}
        />
        <MetricCard
          icon={Building2}
          label="Clientes ativos"
          value={clients.length}
          note={maintenance === null ? "Com cadastro ativo" : <>Recorrente <span className="font-medium text-zinc-300">{brl0(maintenance)}</span>/mês</>}
          loading={clientsQ.loading}
          menu={[{ label: "Ver clientes", onSelect: () => router.push("/clientes-obras") }, { label: "Novo cliente", onSelect: () => router.push("/clientes-obras?novo=1") }]}
        />
        <MetricCard
          icon={Ticket}
          label="Chamados abertos"
          value={kpis.openTickets}
          delta={kpis.ticketsDelta}
          invertDelta
          note={<>{kpis.ticketsDelta === null ? `${kpis.createdNow} novos · ${periodLabel}` : "novos vs. anterior"}{kpis.highOpen > 0 && <> · <span className="font-medium text-red-400">{kpis.highOpen} alta</span></>}</>}
          spark={kpis.ticketsSpark}
          loading={tasksQ.loading}
          menu={[{ label: "Abrir kanban", onSelect: () => router.push("/tickets") }, { label: "Nova tarefa", onSelect: () => router.push("/tickets?novo=1") }]}
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label="Pipeline comercial"
          value={brl0(kpis.pipeline)}
          note={`${kpis.activeOpps} oportunidades em aberto`}
          loading={oppsQ.loading}
          menu={[{ label: "Abrir pipeline", onSelect: () => router.push("/leads?aba=pipeline") }, { label: "Novo lead", onSelect: () => router.push("/leads?novo=1") }]}
        />
      </div>

      {tasksQ.error && <ErrorState message="Não foi possível carregar tarefas e chamados." onRetry={tasksQ.reload} />}

      {/* Linha 2 — Desempenho (70%) + Demanda mensal (30%) */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {txQ.loading ? <ChartSkeleton height={300} /> : (
          <GlassCard className="flex flex-col gap-4">
            <CardHeader
              icon={BarChart3}
              title="Desempenho do negócio"
              description={`Receita, despesas e saldo nos últimos ${perfMonths} meses`}
              actions={
                <Tabs value={perfMonths} onValueChange={(v) => setPerfMonths(v as "6" | "12")}>
                  <TabsList className="h-9" aria-label="Janela do gráfico"><TabsTrigger value="6">6 meses</TabsTrigger><TabsTrigger value="12">12 meses</TabsTrigger></TabsList>
                </Tabs>
              }
            />
            {txQ.error ? <ErrorState message="Não foi possível carregar as movimentações financeiras." onRetry={txQ.reload} /> : performance.hasData ? (
              <>
                <p className="text-sm text-muted-foreground">Receita acumulada <span className="ml-1 text-lg font-semibold tabular-nums text-foreground">{brl(performance.total)}</span></p>
                <div className="h-[280px]"><PerformanceChart data={performance.rows} /></div>
              </>
            ) : <EmptyState icon={BarChart3} title="Sem movimentações registradas" description="Cadastre entradas e saídas no financeiro para acompanhar o desempenho." className="h-[300px]" />}
          </GlassCard>
        )}

        {tasksQ.loading ? <ChartSkeleton height={300} /> : (
          <GlassCard className="flex flex-col gap-4">
            <CardHeader icon={TrendingUp} title="Demanda mensal" description="Tarefas e chamados abertos por mês" />
            {demand.hasData ? (
              <>
                <p className="text-sm text-muted-foreground"><span className="text-lg font-semibold tabular-nums text-foreground">{demand.current}</span> neste mês</p>
                <div className="h-[280px]"><MonthlyBarsChart data={demand.rows} name="Abertas" /></div>
              </>
            ) : <EmptyState icon={TrendingUp} title="Nenhuma demanda ainda" className="h-[300px]" />}
          </GlassCard>
        )}
      </div>

      {/* Linha 3 — Atividades (40%) + Progresso (40%) + Agenda (20%) */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,4fr)_minmax(0,4fr)_minmax(280px,3fr)]">
        <GlassCard className="flex flex-col gap-4">
          <CardHeader icon={Activity} title="Atividades recentes" description="Últimas movimentações do sistema" actions={<CardLink href="/tickets" />} />
          {loadingCore ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : activity.length === 0 ? (
            <EmptyState icon={Activity} title="Nenhuma atividade ainda" description="Chamados, tarefas e movimentações aparecem aqui." />
          ) : (
            <ul className="-mx-2 divide-y divide-white/[0.05]">
              {activity.map((a) => (
                <li key={a.id}>
                  <button type="button" disabled={!a.task} onClick={() => a.task && setOpenTask(a.task)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-white/[0.03]">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border", a.tone)}><a.icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{a.title}</span>
                      <span className="block truncate text-xs text-subtle">{a.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs text-subtle">{relativeTime(a.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <CardHeader icon={ListChecks} title="Tarefas e progresso" description={`${progress.total} tarefas e chamados no total`} actions={<CardLink href="/tickets" />} />
          {tasksQ.loading ? <Skeleton className="h-40" /> : progress.total === 0 ? (
            <EmptyState icon={ListChecks} title="Nenhuma tarefa criada ainda" action={<CardLink href="/tickets?novo=1">Criar primeira tarefa</CardLink>} />
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ProgressDonut data={progress.rows} percent={progress.percent} label="Concluídas" />
              <dl className="w-full flex-1 space-y-3 text-sm">
                {progress.rows.map((r) => (
                  <div key={r.name} className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                    <dt className="flex-1 text-zinc-300">{r.name}</dt>
                    <dd className="w-10 text-right font-semibold tabular-nums text-foreground">{r.value}</dd>
                    <dd className="w-12 text-right text-xs tabular-nums text-subtle">{Math.round((r.value / progress.total) * 100)}%</dd>
                  </div>
                ))}
                <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3">
                  <span className="size-2.5 rounded-full bg-red-500" />
                  <dt className="flex-1 text-zinc-300">Atrasadas</dt>
                  <dd className="w-10 text-right font-semibold tabular-nums text-red-400">{progress.overdue}</dd>
                  <dd className="w-12 text-right text-xs tabular-nums text-red-400/70">{Math.round((progress.overdue / progress.total) * 100)}%</dd>
                </div>
              </dl>
            </div>
          )}
        </GlassCard>

        <div className="lg:col-span-2 xl:col-span-1">
          <AgendaCard tasks={tasks} onOpenTask={setOpenTask} />
        </div>
      </div>

      {/* Linha 4 — recentes */}
      <GlassCard padded={false} className="overflow-hidden">
        <div className="p-5 pb-4">
          <CardHeader icon={Ticket} title="Chamados e tarefas recentes" description="Últimos registros abertos, de qualquer origem" actions={<CardLink href="/tickets" />} />
        </div>
        <DataTable
          bare
          data={recent}
          columns={columns}
          getRowId={(t) => t.id}
          loading={tasksQ.loading}
          pageSize={6}
          onRowClick={setOpenTask}
          empty={{ title: "Nenhum chamado ainda", description: "Os chamados abertos pelo formulário público e as tarefas internas aparecem aqui." }}
          className="border-t border-border"
        />
      </GlassCard>

      <TaskDrawer task={openTask} onOpenChange={(o) => { if (!o) setOpenTask(null) }} />
    </PageContainer>
  )
}
