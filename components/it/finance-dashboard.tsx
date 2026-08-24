"use client"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Download, Loader2, Plus, Search, WalletCards } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageLayout } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { brl } from "@/lib/it-service-data"
import { createClient } from "@/lib/supabase/client"

type EntryType = "income" | "expense"
type Entry = { id: string; date: string; description: string; account: string; category: string; type: EntryType; amount: number; status: "Pago" | "Pendente" }

const isoToday = () => new Date().toISOString().slice(0, 10)
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }

function EntryForm({ onCreated }: { onCreated: (entry: Entry) => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<EntryType>("income")
  const [saving, setSaving] = useState(false)

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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar movimentação")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Nova movimentação</Button></DialogTrigger>
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

export function FinanceDashboard() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [maintenanceRevenue, setMaintenanceRevenue] = useState(0)
  const [projectsTotal, setProjectsTotal] = useState(0)
  const [account, setAccount] = useState("all"), [type, setType] = useState("all"), [query, setQuery] = useState(""), [from, setFrom] = useState(monthStart()), [to, setTo] = useState(isoToday())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [transactionsPayload, financialsResult] = await Promise.all([
        fetch(`/api/financial-transactions?from=${from}&to=${to}`).then(r => r.json()).catch(() => ({ error: "offline" })),
        supabase.from("client_financials").select("has_maintenance, maintenance_monthly_value, project_total_value"),
      ])
      if (cancelled) return
      if (transactionsPayload.error) {
        setLoadError("Não foi possível carregar as movimentações financeiras.")
      } else {
        const rows: Entry[] = (transactionsPayload.transactions || []).map((t: any) => ({
          id: t.id, date: t.transaction_date, description: t.description, account: t.account_name || "—",
          category: t.category || "Outros", type: t.type as EntryType, amount: Number(t.amount),
          status: t.status === "paid" ? "Pago" as const : "Pendente" as const,
        }))
        setEntries(rows)
      }
      const financials = financialsResult.data ?? []
      setMaintenanceRevenue(financials.filter((f: any) => f.has_maintenance).reduce((s: number, f: any) => s + (f.maintenance_monthly_value ?? 0), 0))
      setProjectsTotal(financials.reduce((s: number, f: any) => s + (f.project_total_value ?? 0), 0))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [from, to])

  const accounts = useMemo(() => [...new Set(entries.map(e => e.account))], [entries])
  const filtered = useMemo(() => entries.filter(e => (account === "all" || e.account === account) && (type === "all" || e.type === type) && `${e.description} ${e.category}`.toLowerCase().includes(query.toLowerCase())), [entries, account, type, query])
  const income = filtered.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0), expense = filtered.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  const chartData = useMemo(() => {
    const daily = new Map<string, { date: string; label: string; Entradas: number; Saídas: number }>()
    for (const entry of filtered) { const current = daily.get(entry.date) ?? { date: entry.date, label: new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Entradas: 0, Saídas: 0 }; if (entry.type === "income") current.Entradas += entry.amount; else current.Saídas += entry.amount; daily.set(entry.date, current) }
    return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">Financeiro</h1><p className="mt-1 text-sm text-muted-foreground">Contas, entradas e saídas detalhadas por período.</p></div><div className="flex gap-2"><Button variant="outline"><Download className="h-4 w-4" />Exportar</Button><EntryForm onCreated={entry => setEntries(current => [entry, ...current])} /></div></header>
    {loading ? <div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
      {loadError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="border-l-2 border-primary bg-card px-5 py-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Receita recorrente (manutenção)</p><CircleDollarSign className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{brl(maintenanceRevenue)}</p><p className="mt-1 text-xs text-muted-foreground">Soma dos contratos de manutenção ativos</p></div>
        <div className="border-l-2 border-primary bg-card px-5 py-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total em projetos contratados</p><WalletCards className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{brl(projectsTotal)}</p><p className="mt-1 text-xs text-muted-foreground">Soma do valor total de todos os projetos</p></div>
        <div className="border-l-2 border-emerald-600 bg-card px-5 py-4"><p className="text-sm text-muted-foreground">Entradas no período</p><p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">{brl(income)}</p></div>
        <div className="border-l-2 border-red-600 bg-card px-5 py-4"><p className="text-sm text-muted-foreground">Saídas no período</p><p className="mt-2 text-2xl font-semibold tabular-nums text-red-700">{brl(expense)}</p></div>
      </div>
      <section className="rounded-xl border bg-card p-5"><div><p className="text-sm font-medium">Visão do período selecionado</p><p className="mt-1 text-xs text-muted-foreground">Valores agrupados por dia conforme os filtros do extrato</p></div>{chartData.length ? <div className="mt-4 h-[210px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={58} tickFormatter={value => Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)} mil` : String(value)} /><Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: .45 }} formatter={value => brl(Number(value))} labelFormatter={label => `Dia ${label}`} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Entradas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} /><Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={36} /></BarChart></ResponsiveContainer></div> : <div className="mt-4 grid h-[210px] place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">Nenhuma movimentação para gerar o gráfico neste período.</div>}</section>
      <section className="rounded-xl border bg-card"><div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_150px_150px_150px_150px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar descrição ou categoria" /></div><Select value={account} onValueChange={setAccount}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas</SelectItem>{accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Entradas e saídas</SelectItem><SelectItem value="income">Somente entradas</SelectItem><SelectItem value="expense">Somente saídas</SelectItem></SelectContent></Select><Input aria-label="Data inicial" type="date" value={from} onChange={e => setFrom(e.target.value)} /><Input aria-label="Data final" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Movimentação</TableHead><TableHead>Conta</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{filtered.map(e => <TableRow key={e.id}><TableCell className="whitespace-nowrap">{new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell><div className="flex items-start gap-2"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${e.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{e.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><p className="font-medium">{e.description}</p></div></TableCell><TableCell>{e.account}</TableCell><TableCell>{e.category}</TableCell><TableCell><span className={`text-xs font-medium ${e.status === "Pago" ? "text-emerald-700" : "text-amber-700"}`}>{e.status}</span></TableCell><TableCell className={`text-right font-semibold tabular-nums ${e.type === "income" ? "text-emerald-700" : "text-red-700"}`}>{e.type === "income" ? "+" : "−"} {brl(e.amount)}</TableCell></TableRow>)}{filtered.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhuma movimentação encontrada neste período.</TableCell></TableRow>}</TableBody></Table></div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>{filtered.length} movimentações exibidas</span><span>Período: {from ? new Date(`${from}T12:00:00`).toLocaleDateString("pt-BR") : "início"} até {to ? new Date(`${to}T12:00:00`).toLocaleDateString("pt-BR") : "hoje"}</span></div>
      </section>
    </>}
  </div></PageLayout>
}
