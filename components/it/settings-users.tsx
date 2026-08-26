"use client"
import { FormEvent,useEffect,useState } from "react"
import { Copy,Eye,EyeOff,KeyRound,Loader2,Plus,RefreshCw,Settings,ShieldCheck,Webhook,UserCog,UsersRound } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
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
import { createLocalUser,getLocalUsers,saveLocalUsers,type LocalManagedUser } from "@/lib/local-users"
import type { PagePermission } from "@/lib/types"

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")

  useEffect(() => {
    fetch("/api/settings/integration").then(r => r.json()).then(p => {
      setWebhookUrl(p.settings?.chamado_webhook_url ?? "")
      setApiKey(p.settings?.agent_api_key ?? "")
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

  if (loading) return <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return <div className="space-y-6">
    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
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
  </div>
}

const pages:Array<{id:PagePermission;label:string;description:string}>=[
 {id:"dashboard",label:"Visão geral",description:"Indicadores e gráficos operacionais"},{id:"clientes_obras",label:"Clientes e acessos",description:"Cadastros, contratos e cofre de senhas"},{id:"ordens_servico",label:"Tickets",description:"Kanban, chamados e créditos"},{id:"operacao_campo",label:"WhatsApp + IA",description:"Conversas e triagem automática"},{id:"equipe_prestadores",label:"Funcionários",description:"Equipe e responsáveis"},{id:"financeiro",label:"Financeiro",description:"Contas, entradas e saídas"},{id:"comercial",label:"Comercial",description:"Oportunidades e contratos"},{id:"configuracoes",label:"Configurações",description:"Usuários e permissões"},
]
const roleLabels:Record<LocalManagedUser["role"],string>={admin:"Administrador",manager:"Gestor",support:"Suporte",finance:"Financeiro",commercial:"Comercial",client:"Cliente",user:"Usuário"}

function UserForm({onCreated}:{onCreated:(u:LocalManagedUser)=>void}){const [open,setOpen]=useState(false),[role,setRole]=useState<LocalManagedUser["role"]>("support"),[permissions,setPermissions]=useState<PagePermission[]>(["dashboard","ordens_servico","operacao_campo"]),[error,setError]=useState("");function toggle(id:PagePermission){setPermissions(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const d=new FormData(e.currentTarget);try{const selected=role==="admin"?pages.map(p=>p.id):permissions;if(!selected.length)throw new Error("Selecione pelo menos uma página");const u=await createLocalUser({name:String(d.get("name")),email:String(d.get("email")),password:String(d.get("password")),role,permissions:selected,active:true});onCreated(u);setOpen(false)}catch(err){setError(err instanceof Error?err.message:"Não foi possível criar")}}return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4"/>Novo usuário</Button></DialogTrigger><DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Criar usuário e definir acessos</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div><Label>Nome completo</Label><Input name="name" required className="mt-1"/></div><div><Label>E-mail de acesso</Label><Input name="email" type="email" required className="mt-1"/></div><div><Label>Senha inicial</Label><Input name="password" type="password" minLength={6} required autoComplete="new-password" className="mt-1"/></div><div><Label>Função</Label><Select value={role} onValueChange={v=>setRole(v as LocalManagedUser["role"])}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div></div><section><div className="mb-3"><h3 className="text-sm font-semibold">Páginas permitidas</h3><p className="text-xs text-muted-foreground">O usuário verá somente as áreas marcadas abaixo.</p></div><div className="grid gap-2 md:grid-cols-2">{pages.map(p=><label key={p.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${role==="admin"||permissions.includes(p.id)?"border-primary/30 bg-primary/5":""}`}><Checkbox checked={role==="admin"||permissions.includes(p.id)} disabled={role==="admin"} onCheckedChange={()=>toggle(p.id)}/><span><span className="block text-sm font-medium">{p.label}</span><span className="text-xs text-muted-foreground">{p.description}</span></span></label>)}</div></section>{error&&<p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit"><ShieldCheck className="h-4 w-4"/>Criar usuário</Button></div></form></DialogContent></Dialog>}

export function SettingsUsers(){const [users,setUsers]=useState<LocalManagedUser[]>([]);useEffect(()=>setUsers(getLocalUsers()),[]);function setActive(id:string,active:boolean){setUsers(current=>{const next=current.map(u=>u.id===id?{...u,active}:u);saveLocalUsers(next);return next})}return <PageLayout><div className="mx-auto max-w-[1440px] space-y-6"><header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">Configurações</h1><p className="mt-1 text-sm text-muted-foreground">Usuários, funções e permissões de acesso ao sistema.</p></div><UserForm onCreated={u=>setUsers(current=>[u,...current])}/></header><Tabs defaultValue="usuarios"><TabsList><TabsTrigger value="usuarios">Usuários</TabsTrigger><TabsTrigger value="integracoes">Integrações</TabsTrigger></TabsList><TabsContent value="usuarios" className="space-y-6"><div className="grid gap-3 md:grid-cols-3"><div className="border-l-2 border-primary bg-card p-4"><UsersRound className="h-4 w-4 text-primary"/><p className="mt-3 text-2xl font-semibold">{users.length+1}</p><p className="text-xs text-muted-foreground">Usuários cadastrados</p></div><div className="border-l-2 border-primary bg-card p-4"><ShieldCheck className="h-4 w-4 text-primary"/><p className="mt-3 text-2xl font-semibold">{users.filter(u=>u.active).length+1}</p><p className="text-xs text-muted-foreground">Acessos ativos</p></div><div className="border-l-2 border-primary bg-card p-4"><KeyRound className="h-4 w-4 text-primary"/><p className="mt-3 text-2xl font-semibold">{pages.length}</p><p className="text-xs text-muted-foreground">Páginas controladas</p></div></div><section className="overflow-hidden rounded-xl border bg-card"><div className="border-b p-4"><h2 className="font-semibold">Usuários do sistema</h2><p className="text-xs text-muted-foreground">Desative um acesso sem apagar o histórico do usuário.</p></div><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Função</TableHead><TableHead>Páginas permitidas</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ativo</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell><p className="font-medium">Administrador local</p><p className="text-xs text-muted-foreground">Sessão administrativa atual</p></TableCell><TableCell><Badge>Administrador</Badge></TableCell><TableCell>Todas as páginas</TableCell><TableCell><span className="text-emerald-700">Online</span></TableCell><TableCell className="text-right"><Switch checked disabled/></TableCell></TableRow>{users.map(u=><TableRow key={u.id}><TableCell><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell><Badge variant="outline">{roleLabels[u.role]}</Badge></TableCell><TableCell><div className="flex max-w-lg flex-wrap gap-1">{u.permissions.slice(0,4).map(id=><Badge key={id} variant="secondary">{pages.find(p=>p.id===id)?.label||id}</Badge>)}{u.permissions.length>4&&<Badge variant="secondary">+{u.permissions.length-4}</Badge>}</div></TableCell><TableCell className={u.active?"text-emerald-700":"text-muted-foreground"}>{u.active?"Liberado":"Bloqueado"}</TableCell><TableCell className="text-right"><Switch checked={u.active} onCheckedChange={v=>setActive(u.id,v)}/></TableCell></TableRow>)}{!users.length&&<TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Nenhum usuário adicional. Use “Novo usuário” para começar.</TableCell></TableRow>}</TableBody></Table></section><div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><Settings className="mt-0.5 h-5 w-5 text-primary"/><div><p className="text-sm font-semibold">Como testar</p><p className="text-xs text-muted-foreground">Crie um usuário, saia da conta atual e entre com o e-mail e a senha cadastrados. O menu e as rotas respeitarão as permissões escolhidas.</p></div></div></TabsContent><TabsContent value="integracoes"><IntegrationSettings/></TabsContent></Tabs></div></PageLayout>}
