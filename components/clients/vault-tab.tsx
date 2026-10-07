"use client"

import type { LucideIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check, Cloud, Copy, Database, Eye, EyeOff, Globe, KeyRound, Loader2, LockKeyhole, Mail, Monitor, MoreHorizontal, Network, Pencil,
  Plus, RefreshCw, Search, Server, ShieldCheck, ShieldOff, Trash2, Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { InputField, SelectField, TextareaField } from "@/components/core/form-fields"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { EmptyState, ErrorState, Skeleton } from "@/components/core/states"
import { cn } from "@/lib/utils"

type AccessType = "computer" | "server" | "network" | "email" | "system" | "website" | "database" | "vpn" | "cloud" | "other"
type Credential = { id: string; access_type: AccessType; label: string; username: string; host: string | null; notes: string | null; updated_at: string }

export const ACCESS_TYPES: Record<AccessType, { label: string; icon: LucideIcon }> = {
  computer: { label: "Computador", icon: Monitor },
  server: { label: "Servidor", icon: Server },
  network: { label: "Rede / Firewall", icon: Wifi },
  email: { label: "E-mail", icon: Mail },
  system: { label: "Sistema", icon: KeyRound },
  website: { label: "Site / painel", icon: Globe },
  database: { label: "Banco de dados", icon: Database },
  vpn: { label: "VPN", icon: Network },
  cloud: { label: "Nuvem", icon: Cloud },
  other: { label: "Outro", icon: LockKeyhole },
}

const REVEAL_SECONDS = 30
const api = (clientId: string, path = "") => `/api/clients/${clientId}/credentials${path}`

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.error || "Erro no cofre"), { code: payload.code as string | undefined, status: response.status })
  return payload as T
}

/** Gera uma senha forte no navegador (crypto.getRandomValues). */
function generatePassword(length = 20) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?-_"
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

function CredentialForm({ clientId, credential, open, onOpenChange, onSaved }: { clientId: string; credential: Credential | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const editing = Boolean(credential)
  const [values, setValues] = useState({ access_type: "computer", label: "", username: "", secret: "", host: "", notes: "" })
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setShowSecret(false)
    setValues({ access_type: credential?.access_type ?? "computer", label: credential?.label ?? "", username: credential?.username ?? "", secret: "", host: credential?.host ?? "", notes: credential?.notes ?? "" })
  }, [open, credential])

  const set = (key: keyof typeof values) => (v: string) => setValues((cur) => ({ ...cur, [key]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing && values.secret.length < 4) { notify.error("Senha muito curta", "Use ao menos 4 caracteres."); return }
    setSaving(true)
    try {
      await call(editing ? api(clientId, `/${credential!.id}`) : api(clientId), { method: editing ? "PATCH" : "POST", body: JSON.stringify(values) })
      notify.success(editing ? "Acesso atualizado" : "Acesso salvo no cofre", values.label)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      notify.error("Não foi possível salvar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
      setValues((cur) => ({ ...cur, secret: "" }))
    }
  }

  return (
    <Modal size="lg" open={open} onOpenChange={onOpenChange} title={editing ? `Editar ${credential!.label}` : "Novo acesso"} description="A senha é criptografada no Supabase Vault e nunca aparece na listagem.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
        <SelectField label="Tipo de acesso" value={values.access_type} onValueChange={set("access_type")} options={Object.entries(ACCESS_TYPES).map(([value, t]) => ({ value, label: t.label }))} />
        <InputField label="Nome do acesso" required placeholder="Ex.: Servidor de arquivos" value={values.label} onChange={(e) => set("label")(e.target.value)} />
        <InputField label="Usuário / login" required autoComplete="off" value={values.username} onChange={(e) => set("username")(e.target.value)} />
        <div className="space-y-1.5">
          <Label htmlFor="vault-secret" className="text-[13px] font-medium text-zinc-300">Senha{!editing && <span className="text-primary" aria-hidden="true">*</span>}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input id="vault-secret" type={showSecret ? "text" : "password"} autoComplete="new-password" value={values.secret} onChange={(e) => set("secret")(e.target.value)} placeholder={editing ? "Deixe em branco para manter" : ""} className="pr-10 font-mono" aria-describedby="vault-secret-hint" />
              <button type="button" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-subtle hover:text-foreground">
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => { set("secret")(generatePassword()); setShowSecret(true) }} aria-label="Gerar senha forte" title="Gerar senha forte"><RefreshCw /></Button>
          </div>
          <p id="vault-secret-hint" className="text-xs text-subtle">{editing ? "Preencha só se quiser trocar a senha." : "Mínimo de 4 caracteres."}</p>
        </div>
        <InputField label="Computador, IP ou endereço" fieldClassName="sm:col-span-2" placeholder="Ex.: SRV-01 · 192.168.0.10 · painel.cliente.com.br" value={values.host} onChange={(e) => set("host")(e.target.value)} />
        <TextareaField label="Observações técnicas" fieldClassName="sm:col-span-2" placeholder="VPN necessária, porta, localização, instruções..." value={values.notes} onChange={(e) => set("notes")(e.target.value)} />
        <div className="flex justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{editing ? "Salvar alterações" : "Salvar no cofre"}</Button>
        </div>
      </form>
    </Modal>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" aria-label={label} title={label} onClick={async () => { await navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-white/[0.06] hover:text-foreground">
      {done ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function CredentialCard({ clientId, item, onEdit, onRemove }: { clientId: string; item: Credential; onEdit: () => void; onRemove: () => void }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState<"reveal" | "copy" | null>(null)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const type = ACCESS_TYPES[item.access_type] ?? ACCESS_TYPES.other
  const Icon = type.icon

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function fetchSecret() {
    const { secret } = await call<{ secret: string }>(api(clientId, `/${item.id}/reveal`), { method: "POST" })
    return secret
  }

  async function toggleReveal() {
    if (secret) { setSecret(null); return }
    setBusy("reveal")
    try {
      setSecret(await fetchSecret())
      // A senha some sozinha depois de alguns segundos.
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSecret(null), REVEAL_SECONDS * 1000)
    } catch (err) {
      notify.error("Não foi possível revelar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function copySecret() {
    setBusy("copy")
    try {
      await navigator.clipboard.writeText(secret ?? (await fetchSecret()))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      notify.success("Senha copiada", item.label)
    } catch (err) {
      notify.error("Não foi possível copiar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Icon className="size-[18px]" strokeWidth={1.75} /></span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-subtle">{type.label} · atualizado em {new Date(item.updated_at).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Ações de ${item.label}`} className="grid size-8 shrink-0 place-items-center rounded-md text-subtle hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Editar / trocar senha</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash2 /> Remover acesso</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-subtle">Usuário</dt>
          <dd className="mt-1 flex items-center gap-1"><span className="truncate font-mono text-zinc-200">{item.username}</span><CopyButton value={item.username} label="Copiar usuário" /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-subtle">Equipamento / endereço</dt>
          <dd className="mt-1 flex items-center gap-1"><span className="truncate font-mono text-xs text-zinc-300">{item.host || "Não informado"}</span>{item.host && <CopyButton value={item.host} label="Copiar endereço" />}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-subtle">Senha</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className={cn("min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-xs", secret ? "border-primary/25 bg-primary/[0.06] text-foreground" : "border-white/[0.08] bg-white/[0.03] text-subtle")} aria-live="polite">
              {secret ?? "••••••••••••••••"}
            </code>
            <Button size="icon" variant="outline" className="size-9" onClick={toggleReveal} disabled={busy !== null} aria-label={secret ? "Ocultar senha" : "Revelar senha"} title={secret ? "Ocultar" : `Revelar por ${REVEAL_SECONDS}s`}>
              {busy === "reveal" ? <Loader2 className="animate-spin" /> : secret ? <EyeOff /> : <Eye />}
            </Button>
            <Button size="icon" variant="outline" className="size-9" onClick={copySecret} disabled={busy !== null} aria-label="Copiar senha" title="Copiar senha">
              {busy === "copy" ? <Loader2 className="animate-spin" /> : copied ? <Check className="text-emerald-400" /> : <Copy />}
            </Button>
          </dd>
        </div>
      </dl>
      {item.notes && <p className="whitespace-pre-wrap border-t border-white/[0.06] pt-3 text-xs text-muted-foreground">{item.notes}</p>}
    </GlassCard>
  )
}

export function VaultTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [credentials, setCredentials] = useState<Credential[] | null>(null)
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null)
  const [query, setQuery] = useState("")
  const [type, setType] = useState<AccessType | "all">("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Credential | null>(null)
  const [removing, setRemoving] = useState<Credential | null>(null)

  const load = useCallback(async () => {
    setFailure(null)
    try {
      const { credentials } = await call<{ credentials: Credential[] }>(api(clientId))
      setCredentials(credentials)
    } catch (err) {
      setCredentials([])
      setFailure({ message: err instanceof Error ? err.message : "Erro ao carregar o cofre", code: (err as { code?: string }).code })
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function remove() {
    const item = removing!
    setRemoving(null)
    try {
      await call(api(clientId, `/${item.id}`), { method: "DELETE" })
      notify.success("Acesso removido do cofre", item.label)
      load()
    } catch (err) {
      notify.error("Não foi possível remover", err instanceof Error ? err.message : undefined)
    }
  }

  const blocked = failure && ["no_session", "forbidden", "not_installed"].includes(failure.code ?? "")
  const items = (credentials ?? []).filter((c) => (type === "all" || c.access_type === type) && `${c.label} ${c.username} ${c.host ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
  const usedTypes = [...new Set((credentials ?? []).map((c) => c.access_type))]

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <CardHeader icon={ShieldCheck} title="Cofre de senhas" description={`Acessos de ${clientName}. Senhas criptografadas no Supabase Vault; cada visualização fica registrada.`} />
        {!blocked && <Button onClick={() => { setEditing(null); setFormOpen(true) }} className="shrink-0"><Plus /> Novo acesso</Button>}
      </GlassCard>

      {credentials === null ? (
        <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-52 rounded-[20px]" />)}</div>
      ) : blocked ? (
        <GlassCard>
          <EmptyState
            icon={failure!.code === "not_installed" ? Database : ShieldOff}
            title={failure!.code === "no_session" ? "Entre com sua conta para abrir o cofre" : failure!.code === "forbidden" ? "Sem acesso ao cofre" : "Cofre ainda não instalado"}
            description={failure!.message}
            className="border-white/[0.06] py-12"
          />
        </GlassCard>
      ) : failure ? (
        <ErrorState message={failure.message} onRetry={load} />
      ) : (
        <>
          {credentials.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar acesso, usuário, IP..." aria-label="Buscar no cofre" className="h-10 pl-10" />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", ...usedTypes] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={cn("rounded-full border px-3 py-1 text-xs transition-colors", type === t ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                    {t === "all" ? `Todos (${credentials.length})` : `${ACCESS_TYPES[t].label} (${credentials.filter((c) => c.access_type === t).length})`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => <CredentialCard key={item.id} clientId={clientId} item={item} onEdit={() => { setEditing(item); setFormOpen(true) }} onRemove={() => setRemoving(item)} />)}
            </div>
          ) : (
            <GlassCard>
              <EmptyState icon={LockKeyhole} title={credentials.length ? "Nenhum acesso encontrado" : "Nenhum acesso cadastrado"} description={credentials.length ? "Tente outro termo ou tipo." : "Cadastre computadores, servidores, redes, e-mails, sistemas e painéis deste cliente."} action={!credentials.length ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Cadastrar primeiro acesso</Button> : undefined} className="border-white/[0.06] py-12" />
            </GlassCard>
          )}
        </>
      )}

      <CredentialForm clientId={clientId} credential={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
      <Modal size="sm" open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null) }} title="Remover acesso do cofre?" description={removing ? `“${removing.label}” deixa de aparecer e a senha não poderá mais ser revelada. O histórico de acessos é mantido.` : undefined}
        footer={<><Button variant="outline" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="destructive" onClick={remove}>Remover acesso</Button></>} />
    </div>
  )
}
