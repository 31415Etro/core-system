"use client"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { Copy, Eye, EyeOff, FileText, KeyRound, Loader2, LockKeyhole, Monitor, Plus, Search, Server, ShieldCheck, Upload, UsersRound, Wifi } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { brl } from "@/lib/it-service-data"

type SupportContract = { plan_name: string | null; monthly_value: number | null; due_day: number | null }
type Client = {
  id: string; name: string; legal_name: string | null; document: string | null
  email: string | null; phone: string | null; support_contracts: SupportContract[]
}

type ClientFinancials = {
  project_total_value: number | null; installments_total: number | null; installments_paid: number | null
  has_maintenance: boolean; maintenance_monthly_value: number | null
  has_change_package: boolean; change_package_scope: string | null
  contract_file_name: string | null; contract_uploaded_at: string | null; contract_signed_url: string | null
}

type AccessType = "computer" | "server" | "network" | "email" | "system" | "other"
type Credential = { id: string; clientId: string; type: AccessType; label: string; username: string; secret: string; host: string; notes: string; updatedAt: string }
const seed: Credential[] = [
  { id: "c1", clientId: "cliente-1", type: "server", label: "Servidor de arquivos", username: "administrador", secret: "Demo@Genes2026", host: "SRV-CLIENTE1-01 · 192.168.10.5", notes: "Acesso administrativo interno", updatedAt: "14/08/2026" },
  { id: "c2", clientId: "cliente-1", type: "computer", label: "PC Financeiro 01", username: "financeiro", secret: "Demo#Financeiro01", host: "DESK-FIN-01", notes: "Windows 11 Pro", updatedAt: "12/08/2026" },
]
const types: Record<AccessType, { label: string; icon: typeof Server }> = { computer: { label: "Computador", icon: Monitor }, server: { label: "Servidor", icon: Server }, network: { label: "Rede / Firewall", icon: Wifi }, email: { label: "E-mail", icon: UsersRound }, system: { label: "Sistema", icon: KeyRound }, other: { label: "Outro", icon: LockKeyhole } }

function CredentialCard({ item }: { item: Credential }) {
  const [visible, setVisible] = useState(false)
  const Icon = types[item.type].icon
  return <div className="rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div><p className="font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{types[item.type].label} · atualizado em {item.updatedAt}</p></div></div><Badge variant="outline">Ativo</Badge></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Usuário</dt><dd className="mt-1 font-mono">{item.username}</dd></div><div><dt className="text-xs text-muted-foreground">Equipamento / endereço</dt><dd className="mt-1 font-mono text-xs">{item.host || "Não informado"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Senha</dt><dd className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2 font-mono text-xs">{visible ? item.secret : "••••••••••••••••"}</code><Button size="icon" variant="outline" onClick={() => setVisible(v => !v)} aria-label={visible ? "Ocultar senha" : "Revelar senha"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button size="icon" variant="outline" onClick={() => navigator.clipboard?.writeText(item.secret)} aria-label="Copiar senha"><Copy className="h-4 w-4" /></Button></dd></div></dl>{item.notes && <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{item.notes}</p>}</div>
}

function CredentialForm({ client, onSave, onCancel }: { client: Client; onSave: (c: Credential) => void; onCancel: () => void }) {
  const [type, setType] = useState<AccessType>("computer")
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    onSave({ id: crypto.randomUUID(), clientId: client.id, type, label: String(d.get("label")), username: String(d.get("username")), secret: String(d.get("secret")), host: String(d.get("host") || ""), notes: String(d.get("notes") || ""), updatedAt: new Date().toLocaleDateString("pt-BR") })
  }
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div><Label>Tipo de acesso</Label><Select value={type} onValueChange={v => setType(v as AccessType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(types).map(([id, t]) => <SelectItem key={id} value={id}>{t.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Nome do acesso</Label><Input className="mt-1" name="label" required placeholder="Ex.: Servidor de arquivos" /></div><div><Label>Usuário / login</Label><Input className="mt-1" name="username" required autoComplete="off" /></div><div><Label>Senha</Label><Input className="mt-1" name="secret" type="password" required autoComplete="new-password" /></div><div className="md:col-span-2"><Label>Computador, IP ou endereço</Label><Input className="mt-1" name="host" placeholder="Ex.: SRV-01, 192.168.0.10 ou painel.com" /></div><div className="md:col-span-2"><Label>Observações técnicas</Label><Textarea className="mt-1" name="notes" placeholder="VPN necessária, localização, instruções..." /></div><div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="submit"><ShieldCheck className="h-4 w-4" />Salvar no cofre</Button></div></form>
}

const emptyFinancials: ClientFinancials = { project_total_value: null, installments_total: null, installments_paid: null, has_maintenance: false, maintenance_monthly_value: null, has_change_package: false, change_package_scope: null, contract_file_name: null, contract_uploaded_at: null, contract_signed_url: null }

function FinancialsTab({ client }: { client: Client }) {
  const [financials, setFinancials] = useState<ClientFinancials>(emptyFinancials)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clients/${client.id}/financials`)
      .then(response => response.json())
      .then(payload => setFinancials(payload.financials ?? emptyFinancials))
      .finally(() => setLoading(false))
  }, [client.id])

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`/api/clients/${client.id}/financials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_total_value: financials.project_total_value,
          installments_total: financials.installments_total,
          installments_paid: financials.installments_paid,
          has_maintenance: financials.has_maintenance,
          maintenance_monthly_value: financials.maintenance_monthly_value,
          has_change_package: financials.has_change_package,
          change_package_scope: financials.change_package_scope,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar")
      setFinancials(current => ({ ...current, ...payload.financials }))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar financeiro do cliente")
    } finally {
      setSaving(false)
    }
  }

  async function uploadContract(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("contract", file)
      const response = await fetch(`/api/clients/${client.id}/financials/contract`, { method: "POST", body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao enviar contrato")
      const refreshed = await fetch(`/api/clients/${client.id}/financials`).then(r => r.json())
      setFinancials(refreshed.financials ?? emptyFinancials)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao enviar contrato")
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <div><Label>Valor total do projeto</Label><Input className="mt-1" type="number" step="0.01" value={financials.project_total_value ?? ""} onChange={e => setFinancials(f => ({ ...f, project_total_value: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="0,00" /></div>
      <div><Label>Parcelas contratadas</Label><Input className="mt-1" type="number" min={0} value={financials.installments_total ?? ""} onChange={e => setFinancials(f => ({ ...f, installments_total: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="0" /></div>
      <div><Label>Parcelas pagas</Label><Input className="mt-1" type="number" min={0} value={financials.installments_paid ?? ""} onChange={e => setFinancials(f => ({ ...f, installments_paid: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="0" /></div>
    </div>

    <div className="rounded-xl border p-4">
      <label className="flex items-center gap-2"><Checkbox checked={financials.has_maintenance} onCheckedChange={v => setFinancials(f => ({ ...f, has_maintenance: Boolean(v) }))} /><span className="text-sm font-medium">Cliente tem manutenção contratada</span></label>
      {financials.has_maintenance && <div className="mt-3 max-w-xs"><Label>Valor mensal da manutenção</Label><Input className="mt-1" type="number" step="0.01" value={financials.maintenance_monthly_value ?? ""} onChange={e => setFinancials(f => ({ ...f, maintenance_monthly_value: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="0,00" /></div>}
    </div>

    <div className="rounded-xl border p-4">
      <label className="flex items-center gap-2"><Checkbox checked={financials.has_change_package} onCheckedChange={v => setFinancials(f => ({ ...f, has_change_package: Boolean(v) }))} /><span className="text-sm font-medium">Cliente tem pacote de alteração ou implementação</span></label>
      {financials.has_change_package && <div className="mt-3"><Label>O que o pacote/projeto contempla</Label><Textarea className="mt-1" value={financials.change_package_scope ?? ""} onChange={e => setFinancials(f => ({ ...f, change_package_scope: e.target.value }))} placeholder="Descreva o escopo contratado" /></div>}
    </div>

    <div className="rounded-xl border p-4">
      <p className="text-sm font-medium">Contrato</p>
      {financials.contract_file_name ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-sm">{financials.contract_file_name}</span>
          {financials.contract_signed_url && <a href={financials.contract_signed_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">Baixar contrato</a>}
        </div>
      ) : <p className="mt-1 text-sm text-muted-foreground">Nenhum contrato anexado.</p>}
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {financials.contract_file_name ? "Substituir contrato (PDF)" : "Anexar contrato (PDF)"}
        <input className="hidden" type="file" accept="application/pdf" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) uploadContract(file); e.target.value = "" }} />
      </label>
    </div>

    <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar financeiro</Button></div>
  </div>
}

function ClientDetails({ client, open, onOpenChange, credentials, onAdd }: { client: Client | null; open: boolean; onOpenChange: (v: boolean) => void; credentials: Credential[]; onAdd: (c: Credential) => void }) {
  const [adding, setAdding] = useState(false)
  if (!client) return null
  const items = credentials.filter(c => c.clientId === client.id)
  const contract = client.support_contracts?.[0]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto"><DialogHeader><div className="flex flex-wrap items-start justify-between gap-3 pr-8"><div><DialogTitle className="text-2xl">{client.name}</DialogTitle><p className="mt-1 text-sm text-muted-foreground">{client.legal_name} · {client.document}</p></div></div></DialogHeader><Tabs defaultValue="vault"><TabsList><TabsTrigger value="vault"><KeyRound className="mr-1 h-4 w-4" />Cofre de acessos ({items.length})</TabsTrigger><TabsTrigger value="plano">Plano de suporte</TabsTrigger><TabsTrigger value="financeiro">Financeiro do projeto</TabsTrigger><TabsTrigger value="contact">Dados cadastrais</TabsTrigger></TabsList><TabsContent value="vault" className="space-y-4"><div className="flex flex-col justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Cofre protegido</p><p className="text-xs text-muted-foreground">Senhas mascaradas e preparadas para criptografia pelo Supabase Vault.</p></div></div>{!adding && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Novo acesso</Button>}</div>{adding ? <div className="rounded-xl border p-5"><h3 className="mb-4 font-semibold">Cadastrar acesso para {client.name}</h3><CredentialForm client={client} onCancel={() => setAdding(false)} onSave={c => { onAdd(c); setAdding(false) }} /></div> : items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map(item => <CredentialCard key={item.id} item={item} />)}</div> : <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center"><div><LockKeyhole className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Nenhum acesso cadastrado</p><p className="mt-1 text-sm text-muted-foreground">Cadastre computadores, servidores, redes e sistemas.</p></div></div>}</TabsContent><TabsContent value="plano"><div className="grid gap-4 rounded-xl border p-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Plano</p><p className="mt-1 font-medium">{contract?.plan_name ?? "Sem plano recorrente"}</p></div><div><p className="text-xs text-muted-foreground">Vencimento</p><p className="mt-1 font-medium">{contract?.due_day ? `Dia ${contract.due_day}` : "—"}</p></div><div><p className="text-xs text-muted-foreground">Mensalidade</p><p className="mt-1 font-medium">{contract?.monthly_value ? brl(contract.monthly_value) : "—"}</p></div></div></TabsContent><TabsContent value="financeiro"><FinancialsTab client={client} /></TabsContent><TabsContent value="contact"><div className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Razão social</p><p className="mt-1 font-medium">{client.legal_name ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">CNPJ</p><p className="mt-1 font-medium">{client.document ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">E-mail</p><p className="mt-1 font-medium">{client.email ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Telefone</p><p className="mt-1 font-medium">{client.phone ?? "—"}</p></div></div></TabsContent></Tabs></DialogContent></Dialog>
}

export function ClientsVault() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Client | null>(null)
  const [credentials, setCredentials] = useState(seed)

  useEffect(() => {
    fetch("/api/clients")
      .then(response => response.json())
      .then(payload => setClients(payload.clients ?? []))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => clients.filter(c => `${c.name} ${c.legal_name ?? ""} ${c.document ?? ""}`.toLowerCase().includes(query.toLowerCase())), [clients, query])

  return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="border-b pb-5"><h1 className="text-3xl font-semibold tracking-tight">Clientes e acessos</h1><p className="mt-1 text-sm text-muted-foreground">Contratos, financeiro do projeto e cofre técnico de cada cliente.</p></header><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9" placeholder="Buscar cliente ou CNPJ" /></div>
    {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <div className="overflow-hidden rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>CNPJ</TableHead><TableHead>Plano</TableHead><TableHead>Acessos salvos</TableHead><TableHead>Vencimento</TableHead><TableHead>Mensalidade</TableHead></TableRow></TableHeader><TableBody>{rows.map(c => { const contract = c.support_contracts?.[0]; return <TableRow key={c.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setSelected(c)} onKeyDown={e => { if (e.key === "Enter") setSelected(c) }}><TableCell><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.legal_name}</p></TableCell><TableCell>{c.document ?? "—"}</TableCell><TableCell>{contract?.plan_name ?? "—"}</TableCell><TableCell><Badge variant="outline"><KeyRound />{credentials.filter(x => x.clientId === c.id).length}</Badge></TableCell><TableCell>{contract?.due_day ? `Dia ${contract.due_day}` : "—"}</TableCell><TableCell>{contract?.monthly_value ? brl(contract.monthly_value) : "—"}</TableCell></TableRow> })}</TableBody></Table>{!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>}</div>}
    <p className="text-xs text-muted-foreground">Clique em um cliente para abrir os dados, o financeiro do projeto e o cofre de acessos.</p>
    <ClientDetails client={selected} open={Boolean(selected)} onOpenChange={v => { if (!v) setSelected(null) }} credentials={credentials} onAdd={c => setCredentials(current => [c, ...current])} />
  </div></PageLayout>
}
