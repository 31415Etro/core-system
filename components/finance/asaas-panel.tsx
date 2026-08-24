"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, CircleDollarSign, ExternalLink, Loader2, Plus, QrCode, Receipt, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { brl } from "@/lib/it-service-data"

type Client = {
  id: string; name: string; legal_name: string | null; document: string; email: string | null; phone: string | null
  asaas_customer_id: string | null; support_contracts: { monthly_value: number; due_day: number; plan_name: string }[]
}

type Charge = {
  id: string; asaas_payment_id: string; billing_type: string; value: number; due_date: string
  description: string | null; status: string; invoice_url: string | null; bank_slip_url: string | null
  pix_qr_code_id: string | null; created_at: string; clients: { name: string } | null
}

type Subscription = {
  id: string; asaas_subscription_id: string; billing_type: string; value: number; cycle: string
  next_due_date: string; end_date: string | null; description: string | null; status: string
  clients: { name: string } | null
}

const statusStyle: Record<string, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  RECEIVED: "border-emerald-300 bg-emerald-50 text-emerald-700",
  CONFIRMED: "border-emerald-300 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-red-300 bg-red-50 text-red-700",
  ACTIVE: "border-emerald-300 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-slate-300 bg-slate-50 text-slate-600",
}

const cycleLabel: Record<string, string> = {
  WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal", BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral", SEMIANNUALLY: "Semestral", YEARLY: "Anual",
}

function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  useEffect(() => { fetch("/api/clients").then(r => r.json()).then(p => setClients(p.clients ?? [])).catch(() => {}) }, [])
  return clients
}

function ClientPicker({ clients, onSelect }: { clients: Client[]; onSelect: (client: Client | null) => void }) {
  const [value, setValue] = useState("manual")
  return <div>
    <Label>Cliente</Label>
    <Select value={value} onValueChange={v => { setValue(v); onSelect(v === "manual" ? null : clients.find(c => c.id === v) || null) }}>
      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="manual">Digitar manualmente...</SelectItem>
        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
}

const emptyChargeFields = { name: "", document: "", email: "", phone: "", billingType: "BOLETO", value: "", dueDate: "", description: "" }

function NewChargeForm({ clients, onCreated }: { clients: Client[]; onCreated: (charge: Charge) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [fields, setFields] = useState(emptyChargeFields)

  function selectClient(client: Client | null) {
    setClientId(client?.id ?? null)
    setFields(current => client
      ? { ...current, name: client.name, document: client.document, email: client.email || "", phone: client.phone || "", value: client.support_contracts?.[0]?.monthly_value ? String(client.support_contracts[0].monthly_value) : current.value }
      : { ...current, name: "", document: "", email: "", phone: "" })
  }

  async function submit() {
    setError(null)
    if (!fields.name.trim() || !fields.document.trim() || !fields.value || !fields.dueDate) { setError("Preencha nome, CPF/CNPJ, valor e vencimento"); return }
    setSaving(true)
    try {
      const response = await fetch("/api/asaas/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name: fields.name, document: fields.document, email: fields.email || undefined, phone: fields.phone || undefined, billingType: fields.billingType, value: Number(fields.value), dueDate: fields.dueDate, description: fields.description || undefined }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao criar cobrança")
      onCreated(payload.charge)
      setOpen(false)
      setClientId(null); setFields(emptyChargeFields)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Nova cobrança avulsa</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova cobrança (ASAAS)</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <ClientPicker clients={clients} onSelect={selectClient} />
        <div><Label>Nome do cliente</Label><Input className="mt-1" value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} placeholder="Nome ou razão social" /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>CPF/CNPJ</Label><Input className="mt-1" value={fields.document} onChange={e => setFields({ ...fields, document: e.target.value })} placeholder="00.000.000/0001-00" /></div>
          <div><Label>Forma de cobrança</Label><Select value={fields.billingType} onValueChange={v => setFields({ ...fields, billingType: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BOLETO">Boleto</SelectItem><SelectItem value="PIX">Pix</SelectItem><SelectItem value="UNDEFINED">Cliente escolhe</SelectItem></SelectContent></Select></div>
          <div><Label>Valor</Label><Input className="mt-1" type="number" value={fields.value} onChange={e => setFields({ ...fields, value: e.target.value })} placeholder="0,00" /></div>
          <div><Label>Vencimento</Label><Input className="mt-1" type="date" value={fields.dueDate} onChange={e => setFields({ ...fields, dueDate: e.target.value })} /></div>
          <div><Label>E-mail (opcional)</Label><Input className="mt-1" value={fields.email} onChange={e => setFields({ ...fields, email: e.target.value })} placeholder="contato@empresa.com" /></div>
          <div><Label>Telefone (opcional)</Label><Input className="mt-1" value={fields.phone} onChange={e => setFields({ ...fields, phone: e.target.value })} placeholder="(47) 90000-0000" /></div>
        </div>
        <div><Label>Descrição (opcional)</Label><Input className="mt-1" value={fields.description} onChange={e => setFields({ ...fields, description: e.target.value })} placeholder="Ex.: Mensalidade de suporte" /></div>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end"><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Gerar cobrança</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

const emptySubFields = { name: "", document: "", email: "", phone: "", billingType: "BOLETO", value: "", cycle: "MONTHLY", nextDueDate: "", description: "", endDate: "" }

function NewSubscriptionForm({ clients, onCreated }: { clients: Client[]; onCreated: (subscription: Subscription) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [fields, setFields] = useState(emptySubFields)

  function selectClient(client: Client | null) {
    setClientId(client?.id ?? null)
    setFields(current => client
      ? { ...current, name: client.name, document: client.document, email: client.email || "", phone: client.phone || "", value: client.support_contracts?.[0]?.monthly_value ? String(client.support_contracts[0].monthly_value) : current.value }
      : { ...current, name: "", document: "", email: "", phone: "" })
  }

  async function submit() {
    setError(null)
    if (!fields.name.trim() || !fields.document.trim() || !fields.value || !fields.nextDueDate) { setError("Preencha nome, CPF/CNPJ, valor e próximo vencimento"); return }
    setSaving(true)
    try {
      const response = await fetch("/api/asaas/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name: fields.name, document: fields.document, email: fields.email || undefined, phone: fields.phone || undefined, billingType: fields.billingType, value: Number(fields.value), cycle: fields.cycle, nextDueDate: fields.nextDueDate, description: fields.description || undefined, endDate: fields.endDate || undefined }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao criar assinatura")
      onCreated(payload.subscription)
      setOpen(false)
      setClientId(null); setFields(emptySubFields)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar assinatura")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline"><CalendarClock className="h-4 w-4" />Nova cobrança pré-programada</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Cobrança recorrente (assinatura ASAAS)</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <ClientPicker clients={clients} onSelect={selectClient} />
        <div><Label>Nome do cliente</Label><Input className="mt-1" value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} placeholder="Nome ou razão social" /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>CPF/CNPJ</Label><Input className="mt-1" value={fields.document} onChange={e => setFields({ ...fields, document: e.target.value })} placeholder="00.000.000/0001-00" /></div>
          <div><Label>Forma de cobrança</Label><Select value={fields.billingType} onValueChange={v => setFields({ ...fields, billingType: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BOLETO">Boleto</SelectItem><SelectItem value="PIX">Pix</SelectItem><SelectItem value="CREDIT_CARD">Cartão</SelectItem></SelectContent></Select></div>
          <div><Label>Valor por ciclo</Label><Input className="mt-1" type="number" value={fields.value} onChange={e => setFields({ ...fields, value: e.target.value })} placeholder="0,00" /></div>
          <div><Label>Periodicidade</Label><Select value={fields.cycle} onValueChange={v => setFields({ ...fields, cycle: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(cycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Primeiro vencimento</Label><Input className="mt-1" type="date" value={fields.nextDueDate} onChange={e => setFields({ ...fields, nextDueDate: e.target.value })} /></div>
          <div><Label>Encerrar em (opcional)</Label><Input className="mt-1" type="date" value={fields.endDate} onChange={e => setFields({ ...fields, endDate: e.target.value })} /></div>
        </div>
        <div><Label>Descrição (opcional)</Label><Input className="mt-1" value={fields.description} onChange={e => setFields({ ...fields, description: e.target.value })} placeholder="Ex.: Mensalidade de suporte" /></div>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end"><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Programar cobrança</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

function SubscriptionsSection({ clients }: { clients: Client[] }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch("/api/asaas/subscriptions").then(r => r.json()).then(p => setSubscriptions(p.subscriptions ?? [])).finally(() => setLoading(false)) }, [])

  async function cancel(id: string) {
    if (!confirm("Cancelar esta cobrança pré-programada?")) return
    const response = await fetch(`/api/asaas/subscriptions/${id}`, { method: "DELETE" })
    if (response.ok) setSubscriptions(current => current.map(s => (s.id === id ? { ...s, status: "CANCELLED" } : s)))
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Cobranças pré-programadas</h3><NewSubscriptionForm clients={clients} onCreated={s => setSubscriptions(current => [s, ...current])} /></div>
    {loading ? <div className="grid min-h-[100px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : <div className="overflow-hidden rounded-xl border bg-card">
      {subscriptions.map(s => <div key={s.id} className="flex items-center justify-between border-b p-4 last:border-0">
        <div>
          <p className="text-sm font-medium">{s.clients?.name || "Cliente"}</p>
          <p className="text-xs text-muted-foreground">{s.billing_type} · {cycleLabel[s.cycle] || s.cycle} · próximo vencimento {new Date(s.next_due_date).toLocaleDateString("pt-BR")}{s.description ? ` · ${s.description}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={statusStyle[s.status] || ""}>{s.status}</Badge>
          <p className="text-sm font-semibold">{brl(s.value)}</p>
          {s.status !== "CANCELLED" && <Button size="icon" variant="ghost" onClick={() => cancel(s.id)}><X className="h-4 w-4" /></Button>}
        </div>
      </div>)}
      {!subscriptions.length && <div className="grid min-h-24 place-items-center text-sm text-muted-foreground">Nenhuma cobrança pré-programada ainda</div>}
    </div>}
  </div>
}

export function AsaasPanel() {
  const clients = useClients()
  const [balance, setBalance] = useState<number | null>(null)
  const [environment, setEnvironment] = useState<string | null>(null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/asaas/balance").then(r => r.json()),
      fetch("/api/asaas/charges").then(r => r.json()),
    ]).then(([balancePayload, chargesPayload]) => {
      if (balancePayload.error) {
        if (balancePayload.error.includes("ASAAS_API_KEY")) setNotConfigured(true)
        else setErrorMsg(balancePayload.error)
      } else {
        setBalance(balancePayload.balance)
        setEnvironment(balancePayload.environment)
      }
      setCharges(chargesPayload.charges ?? [])
    }).catch(error => {
      console.error("[v0] Error loading ASAAS panel:", error)
      setErrorMsg("Não foi possível carregar os dados do ASAAS.")
    }).finally(() => setLoading(false))
  }, [])

  const totals = useMemo(() => {
    const pending = charges.filter(c => c.status === "PENDING" || c.status === "OVERDUE").reduce((s, c) => s + c.value, 0)
    return { pending, count: charges.length }
  }, [charges])

  if (loading) return <div className="grid min-h-[200px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>

  if (notConfigured) return <div className="rounded-xl border border-dashed p-8 text-center">
    <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
    <h3 className="mt-3 font-semibold">Integração com ASAAS não configurada</h3>
    <p className="mt-1 text-sm text-muted-foreground">Adicione ASAAS_API_KEY (e ASAAS_ENV=sandbox ou production) no .env.local para ativar boletos, cobranças e saldo em tempo real.</p>
  </div>

  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-3">
      <div className="border-l-2 border-primary bg-card px-5 py-4">
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Saldo ASAAS {environment === "sandbox" && "(sandbox)"}</p><CircleDollarSign className="h-4 w-4 text-primary" /></div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{balance !== null ? brl(balance) : "—"}</p>
      </div>
      <div className="border-l-2 border-primary bg-card px-5 py-4">
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Cobranças pendentes</p><Receipt className="h-4 w-4 text-primary" /></div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{brl(totals.pending)}</p>
      </div>
      <div className="border-l-2 border-primary bg-card px-5 py-4">
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total de cobranças</p><QrCode className="h-4 w-4 text-primary" /></div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{totals.count}</p>
      </div>
    </div>
    {errorMsg && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errorMsg}</p>}

    <div>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Cobranças avulsas</h3><NewChargeForm clients={clients} onCreated={charge => setCharges(current => [charge, ...current])} /></div>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        {charges.map(charge => <div key={charge.id} className="flex items-center justify-between border-b p-4 last:border-0">
          <div>
            <p className="text-sm font-medium">{charge.clients?.name || "Cliente"}</p>
            <p className="text-xs text-muted-foreground">{charge.billing_type} · vence {new Date(charge.due_date).toLocaleDateString("pt-BR")}{charge.description ? ` · ${charge.description}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={statusStyle[charge.status] || ""}>{charge.status}</Badge>
            <p className="text-sm font-semibold">{brl(charge.value)}</p>
            {(charge.bank_slip_url || charge.invoice_url) && <a href={charge.bank_slip_url || charge.invoice_url || "#"} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="h-4 w-4" /></a>}
          </div>
        </div>)}
        {!charges.length && <div className="grid min-h-24 place-items-center text-sm text-muted-foreground">Nenhuma cobrança criada ainda</div>}
      </div>
    </div>

    <SubscriptionsSection clients={clients} />
  </div>
}
