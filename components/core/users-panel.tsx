"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, UserCog, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PasswordRules } from "@/components/core/change-password"
import { InputField, SelectField } from "@/components/core/form-fields"
import { MetricCard } from "@/components/core/metric-card"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { StatusBadge } from "@/components/core/status-badge"
import { ErrorState, TableSkeleton } from "@/components/core/states"
import type { PagePermission } from "@/lib/types"
import { cn } from "@/lib/utils"

type Role = "admin" | "manager" | "support" | "finance" | "commercial" | "client" | "user"
type ManagedUser = {
  id: string; name: string; email: string; phone: string | null; role: Role; active: boolean; permissions: PagePermission[]
  createdAt: string; lastSignInAt: string | null; mustChangePassword: boolean; isSelf: boolean
}

const ROLE_LABELS: Record<Role, string> = { admin: "Administrador", manager: "Gestor", support: "Suporte", finance: "Financeiro", commercial: "Comercial", client: "Cliente", user: "Usuário" }

export const PAGES: Array<{ id: PagePermission; label: string; description: string }> = [
  { id: "dashboard", label: "Visão geral", description: "Indicadores e gráficos" },
  { id: "clientes_obras", label: "Clientes", description: "Cadastros, contratos e cofre de senhas" },
  { id: "comercial", label: "Comercial", description: "Leads, pipeline e reuniões" },
  { id: "ordens_servico", label: "Tarefas e chamados", description: "Kanban, chamados e créditos" },
  { id: "operacao_campo", label: "WhatsApp + IA", description: "Conversas e triagem automática" },
  { id: "equipe_prestadores", label: "Equipe", description: "Funcionários e responsáveis" },
  { id: "financeiro", label: "Financeiro", description: "Contas, entradas e saídas" },
  { id: "relatorios", label: "Relatórios", description: "Relatórios gerenciais" },
  { id: "configuracoes", label: "Configurações", description: "Empresa, usuários e integrações" },
]

const lastAccess = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Nunca entrou")

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return `Core-${Array.from(bytes, (b) => chars[b % chars.length]).join("")}`
}

type Draft = { name: string; email: string; phone: string; role: Role; permissions: PagePermission[]; active: boolean; password: string }

function UserDialog({ user, open, onOpenChange, onSaved }: { user: ManagedUser | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const editing = Boolean(user)
  const [draft, setDraft] = useState<Draft>({ name: "", email: "", phone: "", role: "support", permissions: ["dashboard"], active: true, password: "" })
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setResetting(false)
    setDraft(user
      ? { name: user.name, email: user.email, phone: user.phone ?? "", role: user.role, permissions: user.permissions, active: user.active, password: "" }
      : { name: "", email: "", phone: "", role: "support", permissions: ["dashboard"], active: true, password: generatePassword() })
  }, [open, user])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const toggle = (id: PagePermission) => set({ permissions: draft.permissions.includes(id) ? draft.permissions.filter((p) => p !== id) : [...draft.permissions, id] })
  const sendPassword = !editing || resetting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = { name: draft.name, email: draft.email, phone: draft.phone, role: draft.role, permissions: draft.permissions, active: draft.active, ...(sendPassword ? { password: draft.password } : {}) }
      const response = await fetch(editing ? `/api/users/${user!.id}` : "/api/users/create", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.")
      notify.success(editing ? "Usuário atualizado" : "Usuário criado", sendPassword ? `Senha provisória: ${draft.password} — será pedida a troca no primeiro acesso.` : draft.name)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal size="lg" open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o) }} title={editing ? `Editar ${user!.name}` : "Novo usuário"} description={editing ? "Dados, função, páginas permitidas e senha." : "O usuário entra com a senha provisória e é obrigado a criar a própria no primeiro acesso."}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Nome completo" required value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          <InputField label="E-mail de acesso" type="email" required value={draft.email} onChange={(e) => set({ email: e.target.value })} />
          <InputField label="Telefone" helper="Opcional" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
          <SelectField label="Função" value={draft.role} onValueChange={(v) => set({ role: v as Role })} disabled={user?.isSelf} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Páginas permitidas</h3>
            <p className="text-xs text-muted-foreground">{draft.role === "admin" ? "Administradores acessam tudo." : "O usuário só vê as áreas marcadas."}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAGES.map((p) => {
              const checked = draft.role === "admin" || draft.permissions.includes(p.id)
              return (
                <label key={p.id} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors", checked ? "border-primary/30 bg-primary/5" : "border-white/[0.08]", draft.role === "admin" && "cursor-default opacity-80")}>
                  <Checkbox checked={checked} disabled={draft.role === "admin"} onCheckedChange={() => toggle(p.id)} />
                  <span><span className="block text-sm font-medium">{p.label}</span><span className="text-xs text-muted-foreground">{p.description}</span></span>
                </label>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/[0.08] p-4">
          {editing && !resetting ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Senha</p>
                <p className="text-xs text-muted-foreground">{user!.isSelf ? "Para a sua própria senha, use Alterar senha no menu do seu usuário." : "Gera uma senha provisória; o usuário troca no próximo acesso."}</p>
              </div>
              {!user!.isSelf && <Button type="button" variant="outline" size="sm" onClick={() => { setResetting(true); set({ password: generatePassword() }) }}><KeyRound /> Redefinir senha</Button>}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <InputField label={editing ? "Nova senha provisória" : "Senha provisória"} required fieldClassName="flex-1" value={draft.password} onChange={(e) => set({ password: e.target.value })} className="font-mono" />
                <Button type="button" variant="outline" size="icon" className="size-10" onClick={() => set({ password: generatePassword() })} aria-label="Gerar outra senha" title="Gerar outra senha"><RefreshCw /></Button>
              </div>
              <PasswordRules value={draft.password} />
              <p className="text-xs text-muted-foreground">Envie essa senha ao usuário. No primeiro acesso ele cria a própria senha.</p>
            </>
          )}
        </section>

        {editing && (
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] p-4">
            <span><span className="block text-sm font-semibold">Acesso liberado</span><span className="text-xs text-muted-foreground">Bloquear impede o login sem apagar o histórico.</span></span>
            <Switch checked={draft.active} disabled={user!.isSelf} onCheckedChange={(v) => set({ active: v })} aria-label="Acesso liberado" />
          </label>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {editing ? "Salvar alterações" : "Criar usuário"}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Usuários reais do sistema (Supabase Auth + perfis), com criação, edição, bloqueio e redefinição de senha. */
export function UsersPanel() {
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Erro ao carregar usuários")
      setUsers(payload.users ?? [])
      setError(null)
    } catch (err) {
      setUsers([])
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários")
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function setActive(u: ManagedUser, active: boolean) {
    setUsers((cur) => cur && cur.map((x) => (x.id === u.id ? { ...x, active } : x)))
    const response = await fetch(`/api/users/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) })
    if (!response.ok) { notify.error("Não foi possível alterar", (await response.json().catch(() => ({}))).error); load() }
    else notify.success(active ? "Acesso liberado" : "Acesso bloqueado", u.name)
  }

  const list = users ?? []
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={UsersRound} label="Usuários cadastrados" value={list.length} note={`${list.filter((u) => u.role === "admin").length} administradores`} loading={!users} />
        <MetricCard icon={ShieldCheck} label="Acessos ativos" value={list.filter((u) => u.active).length} note="Usuários liberados" loading={!users} />
        <MetricCard icon={KeyRound} label="Troca de senha pendente" value={list.filter((u) => u.mustChangePassword).length} note="Senha provisória" loading={!users} />
      </div>

      <section className="glass overflow-hidden rounded-[20px]">
        <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold tracking-tight">Usuários do sistema</h2>
            <p className="text-xs text-muted-foreground">Crie acessos, defina as páginas de cada um e redefina senhas.</p>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus /> Novo usuário</Button>
        </div>
        {error ? <div className="p-5"><ErrorState message={error} onRetry={load} /></div> : !users ? <TableSkeleton rows={4} /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Função</TableHead><TableHead>Páginas</TableHead><TableHead>Último acesso</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{u.name}{u.isSelf && <span className="ml-2 text-xs font-normal text-subtle">(você)</span>}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell><Badge variant={u.role === "admin" ? "default" : "outline"}>{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell>
                    {u.role === "admin" ? <span className="text-zinc-300">Todas</span> : (
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {u.permissions.slice(0, 3).map((id) => <Badge key={id} variant="secondary">{PAGES.find((p) => p.id === id)?.label ?? id}</Badge>)}
                        {u.permissions.length > 3 && <Badge variant="secondary">+{u.permissions.length - 3}</Badge>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-300">{lastAccess(u.lastSignInAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge tone={u.active ? "success" : "neutral"}>{u.active ? "Liberado" : "Bloqueado"}</StatusBadge>
                      {u.mustChangePassword && <StatusBadge tone="warning" dot={false}>Senha provisória</StatusBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch checked={u.active} disabled={u.isSelf} onCheckedChange={(v) => setActive(u, v)} aria-label={`Acesso de ${u.name}`} />
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setDialogOpen(true) }} aria-label={`Editar ${u.name}`}><Pencil /> Editar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!list.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground"><UserCog className="mx-auto mb-2 size-6" />Nenhum usuário.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </section>

      <UserDialog user={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  )
}
