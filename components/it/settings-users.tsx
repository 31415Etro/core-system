"use client"
import { FormEvent,useEffect,useState } from "react"
import { Copy,Eye,EyeOff,KeyRound,Loader2,Plus,RefreshCw,Settings,ShieldCheck,Webhook,UserCog,UsersRound } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { useQueryParam } from "@/lib/use-query-param"
import { useRouter } from "next/navigation"
import { CompanySettings, GeneralSettings, InfrastructureSettings, IntegrationsCatalog, SecuritySettings, SETTINGS_TABS, type SettingsTab } from "@/components/core/settings-sections"
import { MetricCard } from "@/components/core/metric-card"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { StatusBadge } from "@/components/core/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table"
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs"
import type { PagePermission } from "@/lib/types"
import { UsersPanel } from "@/components/core/users-panel"

const WEBHOOK_FIELDS: Array<{ field: string; description: string }> = [
  { field: "event", description: '"chamado.created"' },
  { field: "task_id", description: "ID interno do chamado" },
  { field: "os_number", description: "Número da OS, ex.: OS-0001" },
  { field: "client_id", description: "ID do cliente no sistema" },
  { field: "company_name", description: "Nome da empresa do cliente" },
  { field: "requester_name", description: "Nome de quem abriu o chamado" },
  { field: "request_type", description: '"nova_funcionalidade" | "manutencao" | "nova_pagina" | "ajuste"' },
  { field: "adjustment_page", description: "Página do ajuste (só quando request_type = ajuste)" },
  { field: "in_development", description: "true/false — projeto em desenvolvimento (até 3 ajustes grátis por página)" },
  { field: "cost_acknowledged", description: "true/false/null — ciência do custo adicional" },
  { field: "priority", description: '"baixa" | "media" | "alta"' },
  { field: "status", description: 'Sempre "triagem" na criação' },
  { field: "title", description: "Título do chamado" },
  { field: "description", description: "Descrição enviada pelo cliente" },
  { field: "audio_transcript", description: "Transcrição do áudio, se houver" },
  { field: "estimated_window", description: "Texto do prazo/custo estimado" },
  { field: "photos", description: "Lista de { file_name, url } das fotos anexadas" },
  { field: "audio", description: "{ file_name, url } do áudio anexado, ou null" },
  { field: "created_at", description: "Data/hora ISO de criação" },
  { field: "callback.update_url", description: "URL para o agente enviar PATCH e alterar o chamado" },
  { field: "callback.auth_header", description: 'Nome do header a enviar: "x-api-key" (use a chave abaixo)' },
]

function IntegrationSettings() {
  const [webhookUrl, setWebhookUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [mcApiKey, setMcApiKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regeneratingMc, setRegeneratingMc] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showMcKey, setShowMcKey] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")

  useEffect(() => {
    fetch("/api/settings/integration").then(r => r.json()).then(p => {
      setWebhookUrl(p.settings?.chamado_webhook_url ?? "")
      setApiKey(p.settings?.agent_api_key ?? "")
      setMcApiKey(p.settings?.mc_climatizacao_ticket_api_key ?? "")
    }).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setSavedMsg("")
    try {
      const response = await fetch("/api/settings/integration", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chamado_webhook_url: webhookUrl.trim() }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar")
      setSavedMsg("Webhook salvo.")
    } catch (error) {
      setSavedMsg(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function regenerate() {
    if (!confirm("Gerar uma nova chave? A chave antiga para de funcionar imediatamente.")) return
    setRegenerating(true)
    try {
      const response = await fetch("/api/settings/integration/regenerate-key", { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao gerar chave")
      setApiKey(payload.settings.agent_api_key)
      setShowKey(true)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao gerar chave")
    } finally {
      setRegenerating(false)
    }
  }

  async function regenerateMc() {
    if (!confirm("Gerar uma nova chave para a MC Climatização? A chave antiga para de funcionar imediatamente.")) return
    setRegeneratingMc(true)
    try {
      const response = await fetch("/api/settings/integration/regenerate-mc-key", { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao gerar chave")
      setMcApiKey(payload.settings.mc_climatizacao_ticket_api_key)
      setShowMcKey(true)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao gerar chave")
    } finally {
      setRegeneratingMc(false)
    }
  }

  if (loading) return <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return <div className="space-y-6">
    <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
      <Webhook className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold">Webhook de chamados</p>
        <p className="mt-1 text-xs text-muted-foreground">Toda vez que um chamado é aberto (página pública de abertura de chamado), o sistema envia um POST com os dados abaixo para a URL cadastrada. Seu agente pode usar o campo "callback.update_url" com a chave de API para alterar o chamado (status, prioridade, descrição, prazo) de volta no sistema.</p>
      </div>
    </div>

    <div className="rounded-xl border bg-card p-5">
      <Label>URL do webhook</Label>
      <div className="mt-1 flex gap-2">
        <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://seu-agente.com/webhook/chamados" />
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button>
      </div>
      {savedMsg && <p className="mt-2 text-xs text-muted-foreground">{savedMsg}</p>}
    </div>

    <div className="rounded-xl border bg-card p-5">
      <Label>Chave de API do agente</Label>
      <p className="mt-1 text-xs text-muted-foreground">Seu agente envia essa chave no header <code className="rounded bg-muted px-1">x-api-key</code> para poder atualizar chamados via <code className="rounded bg-muted px-1">callback.update_url</code>.</p>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">{showKey ? apiKey : "•".repeat(Math.min(apiKey.length, 48))}</code>
        <Button size="icon" variant="outline" onClick={() => setShowKey(v => !v)} aria-label={showKey ? "Ocultar chave" : "Revelar chave"}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        <Button size="icon" variant="outline" onClick={() => navigator.clipboard?.writeText(apiKey)} aria-label="Copiar chave"><Copy className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={regenerate} disabled={regenerating}>{regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Gerar nova</Button>
      </div>
    </div>

    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4"><h2 className="font-semibold">Campos enviados no webhook</h2><p className="text-xs text-muted-foreground">JSON enviado por POST a cada chamado novo.</p></div>
      <Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader><TableBody>{WEBHOOK_FIELDS.map(f => <TableRow key={f.field}><TableCell className="font-mono text-xs">{f.field}</TableCell><TableCell className="text-sm text-muted-foreground">{f.description}</TableCell></TableRow>)}</TableBody></Table>
    </div>

    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <Webhook className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold">API de chamados — MC Climatização</p>
        <p className="mt-1 text-xs text-muted-foreground">O sistema da MC Climatização chama esse endpoint diretamente (sem formulário) para abrir um chamado de "Ajuste" já classificado. Requer a chave abaixo no header <code className="rounded bg-muted px-1">x-api-key</code>.</p>
      </div>
    </div>

    <div className="rounded-xl border bg-card p-5">
      <Label>Chave de API — MC Climatização</Label>
      <p className="mt-1 text-xs text-muted-foreground">Repasse essa chave para o time de desenvolvimento da MC Climatização configurar no sistema deles.</p>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">{showMcKey ? mcApiKey : "•".repeat(Math.min(mcApiKey.length, 48))}</code>
        <Button size="icon" variant="outline" onClick={() => setShowMcKey(v => !v)} aria-label={showMcKey ? "Ocultar chave" : "Revelar chave"}>{showMcKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        <Button size="icon" variant="outline" onClick={() => navigator.clipboard?.writeText(mcApiKey)} aria-label="Copiar chave"><Copy className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={regenerateMc} disabled={regeneratingMc}>{regeneratingMc ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Gerar nova</Button>
      </div>
    </div>

    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4">
        <h2 className="font-semibold">Como chamar</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1">POST https://genesgroup.vercel.app/api/integrations/mc-climatizacao/tickets</code>
        </p>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Campo do corpo (JSON)</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
        <TableBody>
          <TableRow><TableCell className="font-mono text-xs">component_code</TableCell><TableCell className="text-sm text-muted-foreground">Obrigatório — código do componente/página que o sistema da MC exibe</TableCell></TableRow>
          <TableRow><TableCell className="font-mono text-xs">description</TableCell><TableCell className="text-sm text-muted-foreground">Obrigatório — descrição do problema</TableCell></TableRow>
          <TableRow><TableCell className="font-mono text-xs">cost_acknowledged</TableCell><TableCell className="text-sm text-muted-foreground">Obrigatório — true/false, ciência do custo adicional</TableCell></TableRow>
          <TableRow><TableCell className="font-mono text-xs">requester_name</TableCell><TableCell className="text-sm text-muted-foreground">Opcional — quem reportou, do lado da MC</TableCell></TableRow>
          <TableRow><TableCell className="font-mono text-xs">in_development</TableCell><TableCell className="text-sm text-muted-foreground">Opcional — true/false, projeto em desenvolvimento (até 3 ajustes grátis por página)</TableCell></TableRow>
        </TableBody>
      </Table>
      <div className="border-t bg-muted/30 p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Resposta 201</p>
        <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">{'{ "task_id": "...", "os_number": "OS-0001" }'}</code>
      </div>
    </div>
  </div>
}



export function SettingsUsers(){const [userCount,setUserCount]=useState(0);const [tab,setTab]=useState<SettingsTab>("geral");const router=useRouter();useQueryParam("aba",v=>setTab((SETTINGS_TABS as readonly string[]).includes(v)?v as SettingsTab:"geral"),{keep:true});const go=(t:string)=>{setTab(t as SettingsTab);router.replace(t==="geral"?"/configuracoes":`/configuracoes?aba=${t}`,{scroll:false})};useEffect(()=>{fetch("/api/users",{cache:"no-store"}).then(r=>r.ok?r.json():{users:[]}).then(d=>setUserCount((d.users??[]).length)).catch(()=>{})},[]);return <PageLayout><PageContainer><PageHeader title="Configurações" description="Empresa, usuários, integrações, infraestrutura e segurança." /><Tabs value={tab} onValueChange={go}><TabsList aria-label="Seções das configurações"><TabsTrigger value="geral">Geral</TabsTrigger><TabsTrigger value="empresa">Empresa</TabsTrigger><TabsTrigger value="usuarios">Usuários</TabsTrigger><TabsTrigger value="integracoes">Integrações</TabsTrigger><TabsTrigger value="infraestrutura">Infraestrutura</TabsTrigger><TabsTrigger value="seguranca">Segurança</TabsTrigger></TabsList><TabsContent value="geral" className="mt-4"><GeneralSettings users={userCount} onGo={go}/></TabsContent><TabsContent value="empresa" className="mt-4"><CompanySettings/></TabsContent><TabsContent value="usuarios" className="mt-4"><UsersPanel/></TabsContent><TabsContent value="integracoes" className="mt-4 space-y-6"><IntegrationsCatalog/><IntegrationSettings/></TabsContent><TabsContent value="infraestrutura" className="mt-4"><InfrastructureSettings/></TabsContent><TabsContent value="seguranca" className="mt-4"><SecuritySettings/></TabsContent></Tabs></PageContainer></PageLayout>}
