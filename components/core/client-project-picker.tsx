"use client"

import { useEffect, useState } from "react"
import { Check, FolderKanban, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type ClientOption = { id: string; name: string }
export type ProjectOption = { id: string; client_id: string; name: string }

const NONE = "__none__"

/**
 * Cliente + projeto de uma tarefa. O projeto depende do cliente (lista só os projetos dele)
 * e pode ser criado na hora. `requireClient` remove a opção "sem cliente".
 */
export function ClientProjectPicker({
  clients, clientId, projectId, onChange, requireClient = false, layout = "row", className,
}: {
  clients: ClientOption[]
  clientId: string | null
  projectId: string | null
  onChange: (value: { clientId: string | null; projectId: string | null }) => void
  requireClient?: boolean
  layout?: "row" | "stack"
  className?: string
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCreating(false)
    setError(null)
    if (!clientId) { setProjects([]); return }
    let alive = true
    setLoading(true)
    fetch(`/api/projects?client_id=${clientId}`, { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => { if (!alive) return; setUnavailable(!ok && body.code === "not_installed"); setProjects(ok ? body.projects ?? [] : []) })
      .catch(() => alive && setProjects([]))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [clientId])

  async function createProject() {
    if (!clientId || !newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, name: newName }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar o projeto.")
      setProjects((cur) => [...cur, payload.project].sort((a, b) => a.name.localeCompare(b.name)))
      onChange({ clientId, projectId: payload.project.id })
      setCreating(false)
      setNewName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o projeto.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("grid gap-3", layout === "row" && "sm:grid-cols-2")}>
        <div>
          <Label>Cliente{requireClient ? "" : " (opcional)"}</Label>
          <Select value={clientId ?? NONE} onValueChange={(v) => onChange({ clientId: v === NONE ? null : v, projectId: null })}>
            <SelectTrigger className="mt-1 w-full" aria-label="Cliente"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
            <SelectContent>
              {!requireClient && <SelectItem value={NONE}>Sem cliente (tarefa interna)</SelectItem>}
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Projeto (opcional)</Label>
          {creating ? (
            <div className="mt-1 flex gap-1.5">
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do projeto" aria-label="Nome do novo projeto"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createProject() } if (e.key === "Escape") setCreating(false) }} />
              <Button type="button" size="icon" className="shrink-0" onClick={createProject} disabled={saving || !newName.trim()} aria-label="Criar projeto">{saving ? <Loader2 className="animate-spin" /> : <Check />}</Button>
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => setCreating(false)} aria-label="Cancelar"><X /></Button>
            </div>
          ) : (
            <Select value={projectId ?? NONE} disabled={!clientId || loading || unavailable}
              onValueChange={(v) => { if (v === "__new__") { setCreating(true); setNewName("") } else onChange({ clientId, projectId: v === NONE ? null : v }) }}>
              <SelectTrigger className="mt-1 w-full" aria-label="Projeto">
                <SelectValue placeholder={!clientId ? "Escolha o cliente primeiro" : loading ? "Carregando..." : "Sem projeto"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem projeto</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}><FolderKanban className="size-3.5 text-subtle" />{p.name}</SelectItem>)}
                <SelectItem value="__new__"><Plus className="size-3.5 text-primary" />Novo projeto…</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {unavailable && <p className="text-xs text-amber-300">Projetos ainda não instalados no banco (script 223).</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
