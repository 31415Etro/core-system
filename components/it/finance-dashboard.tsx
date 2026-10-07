"use client"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, CalendarClock, CircleDollarSign, Download, Loader2, Plus, Receipt, Repeat, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageLayout } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/components/core/data-table"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { MetricCard } from "@/components/core/metric-card"
import { notify } from "@/components/core/notify"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { StatusBadge } from "@/components/core/status-badge"
import { EmptyState, MetricSkeleton, Skeleton } from "@/components/core/states"
import { brl } from "@/lib/it-service-data"
import { useApi } from "@/lib/use-api"
import { useQueryParam } from "@/lib/use-query-param"
import { createClient } from "@/lib/supabase/client"

type EntryType = "income" | "expense"
type Entry = { id: string; date: string; description: string; account: string; category: string; type: EntryType; amount: number; status: "Pago" | "Pendente" }

const isoToday = () => new Date().toISOString().slice(0, 10)
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }

function EntryForm({ onCreated }: { onCreated: (entry: Entry) => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<EntryType>("income")
  const [saving, setSaving] = useState(false)
  useQueryParam("novo", () => setOpen(true))

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setSaving(true)
    try {
      const response = await fetch("/api/financial-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          description: String(data.get("description")),
          amount: Number(String(data.get("amount")).replace(",", ".")),
          transaction_date: String(data.get("date")),
          account_name: String(data.get("account") || ""),
          category: String(data.get("category") || ""),
          status: String(data.get("status")) === "Pendente" ? "pending" : "paid",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar movimentação")
      const t = payload.transaction
      onCreated({ id: t.id, date: t.transaction_date, description: t.description, account: t.account_name || "—", category: t.category || "Outros", type: t.type, amount: Number(t.amount), status: t.status === "paid" ? "Pago" : "Pendente" })
      setOpen(false)
      notify.success("Movimentação registrada", t.description)
    } catch (error) {
      notify.error("Erro ao salvar movimentação", error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus />Nova movimentação</Button></DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Cadastrar entrada ou saída</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div><Label>Tipo</Label><Select value={type} onValueChange={v => setType(v as EntryType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Entrada</SelectItem><SelectItem value="expense">Saída</SelectItem></SelectContent></Select></div>
        <div><Label>Conta / banco</Label><Input name="account" placeholder="Ex.: Ailos, Nubank, Inter" required className="mt-1" /></div>
        <div><Label>Data</Label><Input name="date" type="date" defaultValue={isoToday()} required className="mt-1" /></div>
        <div><Label>Valor</Label><Input name="amount" inputMode="decimal" placeholder="0,00" required className="mt-1" /></div>
        <div className="md:col-span-2"><Label>Descrição</Label><Input name="description" placeholder="Ex.: Mensalidade de manutenção" required className="mt-1" /></div>
        <div><Label>Categoria</Label><Input name="category" placeholder="Contratos, software, pessoal..." required className="mt-1" /></div>
        <div><Label>Status</Label><Select name="status" defaultValue="Pago"><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem></SelectContent></Select></div>
        <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar movimentação</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}

type Status = "Pago" | "Pendente" | "Atrasado"
const statusOf = (e: Entry): Status => (e.status === "Pago" ? "Pago" : e.date < isoToday() ? "Atrasado" : "Pendente")
const statusTone = { Pago: "success", Pendente: "neutral", Atrasado: "danger" } as const
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR")
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const toEntry = (t: any): Entry => ({
  id: t.id, date: t.transaction_date, description: t.description, account: t.account_name || "—",
  category: t.category || "Outros", type: t.type as EntryType, amount: Number(t.amount),
  status: t.status === "paid" ? "Pago" as const : "Pendente" as const,
})
const TABS = ["visao", "receitas", "despesas", "receber", "recorrencias"] as const
type Tab = (typeof TABS)[number]
const ALL = "all"

type Recurrence = { id: string; client: string; description: string; amount: number; dueDay: number | null; source: string }

function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const blob = new Blob(["﻿" + rows.map(r => r.map(esc).join(";")).join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url)
}

function entryColumns(kind: EntryType): DataTableColumn<Entry>[] {
  return [
    { id: "data", header: "Vencimento", value: e => e.date, cell: e => <span className="tabular-nums text-zinc-300">{fmtDay(e.date)}</span> },
    { id: "descricao", header: "Descrição", value: e => e.description, cell: e => (
      <div className="flex items-center gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${kind === "income" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/[0.05] text-zinc-300"}`}>{kind === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
        <span className="max-w-[320px] truncate font-medium text-foreground">{e.description}</span>
      </div>
    ) },
    { id: "categoria", header: kind === "income" ? "Tipo" : "Categoria", value: e => e.category, cell: e => <span className="text-zinc-300">{e.category}</span> },
    { id: "conta", header: "Conta", value: e => e.account, cell: e => <span className="text-zinc-300">{e.account}</span> },
    { id: "status", header: "Status", value: e => statusOf(e), cell: e => <StatusBadge tone={statusTone[statusOf(e)]}>{statusOf(e)}</StatusBadge> },
    { id: "valor", header: "Valor", align: "right", value: e => e.amount, cell: e => <span className={`font-semibold ${kind === "income" ? "text-emerald-400" : "text-zinc-200"}`}>{kind === "income" ? "+" : "−"} {brl(e.amount)}</span> },
  ]
}

export function FinanceDashboard() {
  const [tab, setTab] = useState<Tab>("visao")
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [maintenanceRevenue, setMaintenanceRevenue] = useState(0)
  const [projectsTotal, setProjectsTotal] = useState(0)
  const [maintenanceRows, setMaintenanceRows] = useState<{ client_id: string; maintenance_monthly_value: number | null }[]>([])
  const [from, setFrom] = useState(monthStart()), [to, setTo] = useState(isoToday())
  const [account, setAccount] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [extra, setExtra] = useState<Entry[]>([])
  const router = useRouter()

  // Contas a receber considera todo o histórico (não só o período); clientes alimentam as recorrências.
  const allTx = useApi<{ transactions: any[] }>("/api/financial-transactions")
  const clientsQ = useApi<{ clients: { id: string; name: string; support_contracts?: { plan_name: string | null; monthly_value: number | null; due_day: number | null }[] }[] }>("/api/clients")

  useQueryParam("aba", v => setTab((TABS as readonly string[]).includes(v) ? v as Tab : "visao"), { keep: true })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      const transactionsPayload = await fetch(`/api/financial-transactions?from=${from}&to=${to}`).then(r => r.json()).catch(() => ({ error: "offline" }))
      if (cancelled) return
      if (transactionsPayload.error) setLoadError("Não foi possível carregar as movimentações financeiras.")
      else setEntries((transactionsPayload.transactions || []).map(toEntry))
      try {
        const { data } = await createClient().from("client_financials").select("client_id, has_maintenance, maintenance_monthly_value, project_total_value")
        if (cancelled) return
        const financials = (data ?? []) as any[]
        setMaintenanceRevenue(financials.filter(f => f.has_maintenance).reduce((s, f) => s + (f.maintenance_monthly_value ?? 0), 0))
        setProjectsTotal(financials.reduce((s, f) => s + (f.project_total_value ?? 0), 0))
        setMaintenanceRows(financials.filter(f => f.has_maintenance))
      } catch {
        // Supabase não configurado neste ambiente: indicadores de contrato ficam zerados.
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [from, to])

  const periodEntries = useMemo(() => [...extra.filter(e => e.date >= from && e.date <= to && !entries.some(x => x.id === e.id)), ...entries], [entries, extra, from, to])
  const accounts = useMemo(() => [...new Set(periodEntries.map(e => e.account))], [periodEntries])
  const byFilters = (e: Entry) => (account === ALL || e.account === account) && (status === ALL || statusOf(e) === status)
  const incomes = periodEntries.filter(e => e.type === "income")
  const expenses = periodEntries.filter(e => e.type === "expense")
  const income = incomes.reduce((s, e) => s + e.amount, 0)
  const expense = expenses.reduce((s, e) => s + e.amount, 0)

  const receivables = useMemo(() => {
    const all = [...extra, ...(allTx.data?.transactions ?? []).map(toEntry)]
    const unique = [...new Map(all.map(e => [e.id, e])).values()]
    return unique.filter(e => e.type === "income" && e.status === "Pendente").sort((a, b) => a.date.localeCompare(b.date))
  }, [allTx.data, extra])
  const overdue = receivables.filter(e => statusOf(e) === "Atrasado")
  const toReceive = receivables.reduce((s, e) => s + e.amount, 0)

  const recurrences = useMemo<Recurrence[]>(() => {
    const clients = clientsQ.data?.clients ?? []
    const nameOf = (id: string) => clients.find(c => c.id === id)?.name ?? "Cliente"
    const fromContracts = clients.flatMap(c => (c.support_contracts ?? []).filter(sc => sc.monthly_value).map((sc, i) => ({ id: `sc-${c.id}-${i}`, client: c.name, description: sc.plan_name ? `Plano ${sc.plan_name}` : "Plano de suporte", amount: Number(sc.monthly_value), dueDay: sc.due_day, source: "Plano de suporte" })))
    const fromMaintenance = maintenanceRows.filter(m => m.maintenance_monthly_value).map(m => ({ id: `mt-${m.client_id}`, client: nameOf(m.client_id), description: "Manutenção mensal", amount: Number(m.maintenance_monthly_value), dueDay: null, source: "Financeiro do projeto" }))
    return [...fromContracts, ...fromMaintenance].sort((a, b) => a.client.localeCompare(b.client))
  }, [clientsQ.data, maintenanceRows])

  const chartData = useMemo(() => {
    const daily = new Map<string, { date: string; label: string; Receitas: number; Despesas: number }>()
    for (const e of periodEntries) { const cur = daily.get(e.date) ?? { date: e.date, label: new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Receitas: 0, Despesas: 0 }; if (e.type === "income") cur.Receitas += e.amount; else cur.Despesas += e.amount; daily.set(e.date, cur) }
    return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [periodEntries])

  function changeTab(next: string) {
    setTab(next as Tab)
    setStatus(ALL)
    router.replace(`/financeiro?aba=${next}`, { scroll: false })
  }

  function exportTab() {
    const header = ["Data", "Descrição", "Categoria", "Conta", "Status", "Valor"]
    const rows = (list: Entry[]) => list.map(e => [e.date, e.description, e.category, e.account, statusOf(e), e.amount.toFixed(2).replace(".", ",")])
    if (tab === "receitas") downloadCsv(`receitas-${from}-a-${to}`, [header, ...rows(incomes.filter(byFilters))])
    else if (tab === "despesas") downloadCsv(`despesas-${from}-a-${to}`, [header, ...rows(expenses.filter(byFilters))])
    else if (tab === "receber") downloadCsv("contas-a-receber", [header, ...rows(receivables)])
    else if (tab === "recorrencias") downloadCsv("recorrencias", [["Cliente", "Descrição", "Valor", "Periodicidade", "Vencimento"], ...recurrences.map(r => [r.client, r.description, r.amount.toFixed(2).replace(".", ","), "Mensal", r.dueDay ? `Dia ${r.dueDay}` : ""])])
    else downloadCsv(`financeiro-${from}-a-${to}`, [header, ...rows(periodEntries)])
  }

  const setPreset = (p: "mes" | "anterior" | "90") => {
    const d = new Date()
    if (p === "mes") { setFrom(monthStart()); setTo(isoToday()) }
    if (p === "anterior") { setFrom(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)); setTo(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)) }
    if (p === "90") { const s = new Date(d); s.setDate(s.getDate() - 89); setFrom(s.toISOString().slice(0, 10)); setTo(isoToday()) }
  }

  const periodBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setPreset("mes")}>Este mês</Button>
      <Button variant="ghost" size="sm" onClick={() => setPreset("anterior")}>Mês passado</Button>
      <Button variant="ghost" size="sm" onClick={() => setPreset("90")}>90 dias</Button>
      <Input aria-label="Data inicial" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="h-9 w-[150px]" />
      <span className="text-xs text-subtle">até</span>
      <Input aria-label="Data final" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="h-9 w-[150px]" />
    </div>
  )

  const filtersToolbar = (
    <>
      <Select value={account} onValueChange={setAccount}><SelectTrigger className="h-10 w-[170px]" aria-label="Conta"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas as contas</SelectItem>{accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-[160px]" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos os status</SelectItem><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Atrasado">Atrasado</SelectItem></SelectContent></Select>
    </>
  )

  const receivableColumns: DataTableColumn<Entry>[] = [
    { id: "descricao", header: "Descrição", value: e => e.description, cell: e => <span className="max-w-[320px] truncate font-medium text-foreground">{e.description}</span> },
    { id: "valor", header: "Valor", align: "right", value: e => e.amount, cell: e => <span className="font-semibold text-foreground">{brl(e.amount)}</span> },
    { id: "vencimento", header: "Vencimento", value: e => e.date, cell: e => <span className="tabular-nums text-zinc-300">{fmtDay(e.date)}</span> },
    { id: "dias", header: "Dias", value: e => Math.round((new Date(`${e.date}T12:00:00`).getTime() - Date.now()) / 864e5), cell: e => {
      const d = Math.round((new Date(`${e.date}T12:00:00`).getTime() - Date.now()) / 864e5)
      return <span className={d < 0 ? "text-red-400" : "text-zinc-300"}>{d < 0 ? `${-d} dias em atraso` : d === 0 ? "Vence hoje" : `Vence em ${d} dias`}</span>
    } },
    { id: "status", header: "Status", value: e => statusOf(e), cell: e => <StatusBadge tone={statusTone[statusOf(e)]}>{statusOf(e)}</StatusBadge> },
    { id: "conta", header: "Conta", value: e => e.account, cell: e => <span className="text-zinc-300">{e.account}</span> },
  ]

  const recurrenceColumns: DataTableColumn<Recurrence>[] = [
    { id: "cliente", header: "Cliente", value: r => r.client, cell: r => <span className="font-medium text-foreground">{r.client}</span> },
    { id: "descricao", header: "Descrição", value: r => r.description, cell: r => <div><p className="text-zinc-300">{r.description}</p><p className="text-xs text-subtle">{r.source}</p></div> },
    { id: "valor", header: "Valor", align: "right", value: r => r.amount, cell: r => <span className="font-semibold text-foreground">{brl(r.amount)}</span> },
    { id: "periodicidade", header: "Periodicidade", cell: () => <span className="text-zinc-300">Mensal</span> },
    { id: "vencimento", header: "Vencimento", value: r => r.dueDay ?? 99, cell: r => <span className="text-zinc-300">{r.dueDay ? `Dia ${r.dueDay}` : "—"}</span> },
    { id: "status", header: "Status", cell: () => <StatusBadge tone="success">Ativa</StatusBadge> },
  ]

  const recurringTotal = recurrences.reduce((s, r) => s + r.amount, 0)

  return <PageLayout><PageContainer>
    <PageHeader title="Financeiro" description="Receitas, despesas, contas a receber e recorrências em um só lugar." actions={<><Button variant="outline" onClick={exportTab}><Download />Exportar</Button><EntryForm onCreated={entry => setExtra(current => [entry, ...current])} /></>} />

    <Tabs value={tab} onValueChange={changeTab}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList aria-label="Seções do financeiro">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber{receivables.length ? ` (${receivables.length})` : ""}</TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
        </TabsList>
        {(tab === "visao" || tab === "receitas" || tab === "despesas") && periodBar}
      </div>

      {loadError && <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-300">{loadError}</p>}

      <TabsContent value="visao" className="mt-4 space-y-4">
        {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(i => <MetricSkeleton key={i} />)}</div> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard icon={TrendingUp} label="Receita no período" value={brl0(income)} note={`${incomes.length} lançamentos`} />
            <MetricCard icon={TrendingDown} label="Despesas" value={brl0(expense)} note={`${expenses.length} lançamentos`} />
            <MetricCard icon={WalletCards} label="Lucro" value={<span className={income - expense >= 0 ? "text-emerald-400" : "text-red-400"}>{brl0(income - expense)}</span>} note={income ? `Margem de ${Math.round(((income - expense) / income) * 100)}%` : "Receitas menos despesas"} />
            <MetricCard icon={CalendarClock} label="A receber" value={brl0(toReceive - overdue.reduce((s, e) => s + e.amount, 0))} note={`${receivables.length - overdue.length} em aberto`} loading={allTx.loading} menu={[{ label: "Ver contas a receber", onSelect: () => changeTab("receber") }]} />
            <MetricCard icon={AlertTriangle} label="Atrasado" value={<span className={overdue.length ? "text-red-400" : undefined}>{brl0(overdue.reduce((s, e) => s + e.amount, 0))}</span>} note={`${overdue.length} vencidas`} loading={allTx.loading} menu={[{ label: "Ver atrasadas", onSelect: () => changeTab("receber") }]} />
            <MetricCard icon={Repeat} label="Receita recorrente" value={brl0(maintenanceRevenue)} note="Contratos de manutenção ativos" menu={[{ label: "Ver recorrências", onSelect: () => changeTab("recorrencias") }]} />
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <GlassCard><CardHeader icon={BarChart3} title="Receitas x Despesas" description="Valores por dia no período selecionado" />
            {loading ? <Skeleton className="mt-4 h-[240px]" /> : chartData.length ? <div className="mt-4 h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--core-text-subtle)" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: "var(--core-text-subtle)" }} tickLine={false} axisLine={false} width={58} tickFormatter={value => Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)} mil` : String(value)} /><Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "rgba(18,18,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "var(--core-text-muted)" }} formatter={value => brl(Number(value))} labelFormatter={label => `Dia ${label}`} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Receitas" fill="var(--core-yellow)" radius={[6, 6, 2, 2]} maxBarSize={32} /><Bar dataKey="Despesas" fill="#71717a" radius={[6, 6, 2, 2]} maxBarSize={32} /></BarChart></ResponsiveContainer></div>
              : <EmptyState icon={BarChart3} title="Nenhuma movimentação neste período" description="Ajuste o período ou cadastre uma nova movimentação." className="mt-4 h-[240px]" />}
          </GlassCard>
          <GlassCard className="space-y-3"><CardHeader icon={Receipt} title="Últimos lançamentos" />
            {loading ? <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div> : periodEntries.length ? (
              <ul className="divide-y divide-white/[0.05]">
                {periodEntries.slice(0, 7).map(e => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${e.type === "income" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/[0.05] text-zinc-300"}`}>{e.type === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{e.description}</p><p className="text-xs text-subtle">{fmtDay(e.date)} · {e.category}</p></div>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${e.type === "income" ? "text-emerald-400" : "text-zinc-200"}`}>{e.type === "income" ? "+" : "−"} {brl(e.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento no período.</p>}
          </GlassCard>
        </div>
      </TabsContent>

      <TabsContent value="receitas" className="mt-4 space-y-2">
        <DataTable data={incomes.filter(byFilters)} columns={entryColumns("income")} getRowId={e => e.id} loading={loading} searchText={e => `${e.description} ${e.category} ${e.account}`} searchPlaceholder="Buscar receita..." toolbar={filtersToolbar} pageSize={12} empty={{ title: "Nenhuma receita no período" }} />
        <p className="text-xs text-subtle">Cliente e contrato de cada receita passam a ser vinculados automaticamente quando a venda gerar o financeiro (Fase 4).</p>
      </TabsContent>

      <TabsContent value="despesas" className="mt-4">
        <DataTable data={expenses.filter(byFilters)} columns={entryColumns("expense")} getRowId={e => e.id} loading={loading} searchText={e => `${e.description} ${e.category} ${e.account}`} searchPlaceholder="Buscar despesa..." toolbar={filtersToolbar} pageSize={12} empty={{ title: "Nenhuma despesa no período" }} />
      </TabsContent>

      <TabsContent value="receber" className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard icon={CalendarClock} label="Total em aberto" value={brl0(toReceive)} note={`${receivables.length} contas`} loading={allTx.loading} />
          <MetricCard icon={AlertTriangle} label="Atrasado" value={<span className={overdue.length ? "text-red-400" : undefined}>{brl0(overdue.reduce((s, e) => s + e.amount, 0))}</span>} note={`${overdue.length} vencidas`} loading={allTx.loading} />
          <MetricCard icon={Receipt} label="Vence em 7 dias" value={brl0(receivables.filter(e => statusOf(e) === "Pendente" && e.date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).reduce((s, e) => s + e.amount, 0))} note="Próximos vencimentos" loading={allTx.loading} />
        </div>
        <DataTable
          data={receivables.filter(e => status === ALL || statusOf(e) === status)}
          columns={receivableColumns}
          getRowId={e => e.id}
          loading={allTx.loading}
          searchText={e => `${e.description} ${e.category} ${e.account}`}
          searchPlaceholder="Buscar conta a receber..."
          toolbar={<Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-[160px]" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos os status</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Atrasado">Atrasado</SelectItem></SelectContent></Select>}
          pageSize={12}
          empty={{ title: "Nenhuma conta em aberto", description: "Receitas cadastradas como pendentes aparecem aqui até serem pagas." }}
        />
      </TabsContent>

      <TabsContent value="recorrencias" className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard icon={Repeat} label="Recorrência mensal" value={brl0(recurringTotal)} note={`${recurrences.length} recorrências ativas`} loading={clientsQ.loading} />
          <MetricCard icon={CircleDollarSign} label="Manutenção" value={brl0(maintenanceRevenue)} note="Financeiro dos projetos" loading={loading} />
          <MetricCard icon={WalletCards} label="Projetos contratados" value={brl0(projectsTotal)} note="Valor total de todos os projetos" loading={loading} />
        </div>
        <DataTable data={recurrences} columns={recurrenceColumns} getRowId={r => r.id} loading={clientsQ.loading} searchText={r => `${r.client} ${r.description}`} searchPlaceholder="Buscar cliente..." pageSize={12} empty={{ title: "Nenhuma recorrência ativa", description: "Planos de suporte e manutenções mensais dos clientes aparecem aqui." }} />
      </TabsContent>
    </Tabs>
  </PageContainer></PageLayout>
}
