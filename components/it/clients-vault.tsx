"use client"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { FileText, KeyRound, Loader2, Plus, Search, ShieldCheck, Upload, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { notify } from "@/components/core/notify"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { MetricCard } from "@/components/core/metric-card"
import { EmptyState, TableSkeleton } from "@/components/core/states"
import { brl } from "@/lib/it-service-data"
import { useQueryParam } from "@/lib/use-query-param"
import { createClient } from "@/lib/supabase/client"

type SupportContract = { plan_name: string | null; monthly_value: number | null; due_day: number | null }
export type Client = {
  id: string; name: string; legal_name: string | null; document: string | null
  email: string | null; phone: string | null; support_contracts: SupportContract[]
}

type ClientFinancials = {
  project_total_value: number | null; installments_total: number | null; installments_paid: number | null
  has_maintenance: boolean; maintenance_monthly_value: number | null
  has_change_package: boolean; change_package_scope: string | null
  contract_file_name: string | null; contract_uploaded_at: string | null; contract_signed_url: string | null
  welcome_presentation_file_name: string | null; welcome_presentation_signed_url: string | null
  schedule_presentation_file_name: string | null; schedule_presentation_signed_url: string | null
}

const emptyFinancials: ClientFinancials = {
  project_total_value: null, installments_total: null, installments_paid: null, has_maintenance: false, maintenance_monthly_value: null,
  has_change_package: false, change_package_scope: null, contract_file_name: null, contract_uploaded_at: null, contract_signed_url: null,
  welcome_presentation_file_name: null, welcome_presentation_signed_url: null, schedule_presentation_file_name: null, schedule_presentation_signed_url: null,
}

type ClientDocumentKind = "contract" | "boas-vindas" | "cronograma"

function DocumentUpload({ label, fileName, signedUrl, clientId, kind, confirmEndpoint, onUploaded }: {
  label: string; fileName: string | null; signedUrl: string | null; clientId: string
  kind: ClientDocumentKind; confirmEndpoint: string; onUploaded: () => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") { alert(`${label}: envie um arquivo PDF`); return }
    if (file.size > 50 * 1024 * 1024) { alert(`${label}: o arquivo deve ter até 50MB`); return }

    setUploading(true)
    try {
      // Upload vai direto do navegador para o Supabase Storage via URL assinada — a Vercel
      // rejeita qualquer requisição de função serverless acima de 4.5MB, e essas apresentações
      // costumam pesar bem mais que isso.
      const urlResponse = await fetch(`/api/clients/${clientId}/financials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, file_name: file.name }),
      })
      const urlPayload = await urlResponse.json()
      if (!urlResponse.ok) throw new Error(urlPayload.error || "Erro ao preparar upload")

      const { error: uploadError } = await createClient().storage
        .from(urlPayload.bucket)
        .uploadToSignedUrl(urlPayload.path, urlPayload.token, file, { contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)

      const confirmResponse = await fetch(confirmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, storage_path: urlPayload.path }),
      })
      const confirmPayload = await confirmResponse.json()
      if (!confirmResponse.ok) throw new Error(confirmPayload.error || `Erro ao registrar ${label.toLowerCase()}`)
      onUploaded()
    } catch (error) {
      alert(error instanceof Error ? error.message : `Erro ao enviar ${label.toLowerCase()}`)
    } finally {
      setUploading(false)
    }
  }

  return <div className="rounded-xl border p-4">
    <p className="text-sm font-medium">{label}</p>
    {fileName ? (
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm">{fileName}</span>
        {signedUrl && <a href={signedUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">Baixar</a>}
      </div>
    ) : <p className="mt-1 text-sm text-muted-foreground">Nenhum arquivo anexado.</p>}
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {fileName ? "Substituir (PDF, até 50MB)" : "Anexar (PDF, até 50MB)"}
      <input className="hidden" type="file" accept="application/pdf" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = "" }} />
    </label>
  </div>
}

export function FinancialsTab({ client }: { client: Pick<Client, "id"> }) {
  const [financials, setFinancials] = useState<ClientFinancials>(emptyFinancials)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  function refresh() {
    return fetch(`/api/clients/${client.id}/financials`)
      .then(response => response.json())
      .then(payload => setFinancials(payload.financials ?? emptyFinancials))
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [client.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

    <DocumentUpload
      label="Contrato"
      fileName={financials.contract_file_name}
      signedUrl={financials.contract_signed_url}
      clientId={client.id}
      kind="contract"
      confirmEndpoint={`/api/clients/${client.id}/financials/contract`}
      onUploaded={refresh}
    />
    <DocumentUpload
      label="Apresentação de boas-vindas"
      fileName={financials.welcome_presentation_file_name}
      signedUrl={financials.welcome_presentation_signed_url}
      clientId={client.id}
      kind="boas-vindas"
      confirmEndpoint={`/api/clients/${client.id}/financials/welcome-presentation`}
      onUploaded={refresh}
    />
    <DocumentUpload
      label="Apresentação de cronograma"
      fileName={financials.schedule_presentation_file_name}
      signedUrl={financials.schedule_presentation_signed_url}
      clientId={client.id}
      kind="cronograma"
      confirmEndpoint={`/api/clients/${client.id}/financials/schedule-presentation`}
      onUploaded={refresh}
    />

    <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar financeiro</Button></div>
  </div>
}

const emptyNewClient = { name: "", legal_name: "", document: "", email: "", phone: "" }

function NewClientForm({ onCreated }: { onCreated: (client: Client) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState(emptyNewClient)
  useQueryParam("novo", () => setOpen(true))

  async function submit() {
    if (!values.name.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao cadastrar cliente")
      onCreated(payload.client)
      setOpen(false)
      setValues(emptyNewClient)
      notify.success("Cliente cadastrado", payload.client?.name)
    } catch (error) {
      notify.error("Erro ao cadastrar cliente", error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus />Novo cliente</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div><Label>Nome fantasia</Label><Input className="mt-1" value={values.name} onChange={e => setValues(v => ({ ...v, name: e.target.value }))} placeholder="Ex.: Cliente LTDA" /></div>
        <div><Label>Razão social</Label><Input className="mt-1" value={values.legal_name} onChange={e => setValues(v => ({ ...v, legal_name: e.target.value }))} placeholder="Razão social completa" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>CNPJ</Label><Input className="mt-1" value={values.document} onChange={e => setValues(v => ({ ...v, document: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
          <div><Label>Telefone</Label><Input className="mt-1" value={values.phone} onChange={e => setValues(v => ({ ...v, phone: e.target.value }))} placeholder="(47) 90000-0000" /></div>
        </div>
        <div><Label>E-mail</Label><Input className="mt-1" type="email" value={values.email} onChange={e => setValues(v => ({ ...v, email: e.target.value }))} placeholder="contato@cliente.com" /></div>
        <div className="flex justify-end"><Button onClick={submit} disabled={saving || !values.name.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Cadastrar</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

export function ClientsVault() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const router = useRouter()
  // Links antigos (?cliente=<id>, ex.: command palette) abrem direto a página do cliente.
  useQueryParam("cliente", id => router.replace(`/clientes-obras/${id}`))
  const openClient = (c: Client) => router.push(`/clientes-obras/${c.id}`)

  useEffect(() => {
    fetch("/api/clients")
      .then(response => response.json())
      .then(payload => setClients(payload.clients ?? []))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => clients.filter(c => `${c.name} ${c.legal_name ?? ""} ${c.document ?? ""}`.toLowerCase().includes(query.toLowerCase())), [clients, query])

  const withPlan = clients.filter(c => c.support_contracts?.[0]?.plan_name).length
  const recurring = clients.reduce((s, c) => s + (c.support_contracts?.[0]?.monthly_value ?? 0), 0)

  return <PageLayout><PageContainer><PageHeader title="Clientes" description="Gerencie sua base de clientes: cofre de senhas, contratos e financeiro do projeto." actions={<NewClientForm onCreated={client => setClients(current => [...current, client].sort((a, b) => a.name.localeCompare(b.name)))} />} />
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard icon={UsersRound} label="Clientes ativos" value={clients.length} note="Com cadastro ativo" loading={loading} />
      <MetricCard icon={ShieldCheck} label="Com plano de suporte" value={withPlan} note={clients.length ? `${Math.round((withPlan / clients.length) * 100)}% da base` : "—"} loading={loading} />
      <MetricCard icon={KeyRound} label="Mensalidades de suporte" value={brl(recurring)} note="Soma dos planos ativos" loading={loading} />
    </div>
    <div className="glass overflow-hidden rounded-[20px]"><div className="border-b border-border p-4"><div className="relative max-w-md"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" /><Input aria-label="Buscar cliente ou CNPJ" value={query} onChange={e => setQuery(e.target.value)} className="h-10 pl-10" placeholder="Buscar cliente ou CNPJ" /></div></div>
    {loading ? <TableSkeleton rows={6} /> : <div><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>CNPJ</TableHead><TableHead>Plano</TableHead><TableHead>Contato</TableHead><TableHead>Vencimento</TableHead><TableHead>Mensalidade</TableHead></TableRow></TableHeader><TableBody>{rows.map(c => { const contract = c.support_contracts?.[0]; return <TableRow key={c.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => openClient(c)} onKeyDown={e => { if (e.key === "Enter") openClient(c) }}><TableCell><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">{c.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-medium text-foreground">{c.name}</p><p className="truncate text-xs text-subtle">{c.legal_name}</p></div></div></TableCell><TableCell>{c.document ?? "—"}</TableCell><TableCell>{contract?.plan_name ?? "—"}</TableCell><TableCell><span className="text-zinc-300">{c.email || c.phone || "—"}</span></TableCell><TableCell>{contract?.due_day ? `Dia ${contract.due_day}` : "—"}</TableCell><TableCell>{contract?.monthly_value ? brl(contract.monthly_value) : "—"}</TableCell></TableRow> })}</TableBody></Table>{!rows.length && <div className="p-6"><EmptyState icon={UsersRound} title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"} description={query ? "Tente outro nome ou CNPJ." : "Cadastre o primeiro cliente para começar."} /></div>}</div>}</div>
    <p className="text-xs text-subtle">Clique em um cliente para abrir o cofre de senhas, os contratos e o financeiro do projeto.</p>
  </PageContainer></PageLayout>
}
