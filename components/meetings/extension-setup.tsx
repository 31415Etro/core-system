"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, KeyRound, Loader2, Plug, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { apiJson } from "@/components/meetings/shared"

type Token = { id: string; name: string; token_prefix: string; created_at: string; last_used_at: string | null }

function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="h-10 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label={`Copiar ${label}`} onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}>
        {done ? <Check className="text-emerald-400" /> : <Copy />}
      </Button>
    </div>
  )
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-core-gradient text-xs font-bold text-black">{n}</span>
    <div className="min-w-0 flex-1 space-y-2 pt-0.5"><p className="text-sm font-medium text-foreground">{title}</p>{children}</div>
  </li>
)

/** Passo a passo de instalação da extensão CORE Meet + gestão dos tokens. */
export function ExtensionSetupModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tokens, setTokens] = useState<Token[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("Meu Chrome")
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  const load = useCallback(async () => {
    try { setError(null); setTokens((await apiJson<{ tokens: Token[] }>("/api/meet/tokens")).tokens) }
    catch (err) { setTokens([]); setError(err instanceof Error ? err.message : "Erro") }
  }, [])

  useEffect(() => { if (open) { setNewToken(null); load() } }, [open, load])

  async function create() {
    setCreating(true)
    try {
      const { token } = await apiJson<{ token: string }>("/api/meet/tokens", { method: "POST", body: JSON.stringify({ name }) })
      setNewToken(token)
      load()
    } catch (err) { notify.error("Não foi possível gerar o token", err instanceof Error ? err.message : undefined) }
    finally { setCreating(false) }
  }

  async function revoke(t: Token) {
    try { await apiJson(`/api/meet/tokens/${t.id}`, { method: "DELETE" }); notify.success("Token revogado", t.name); load() }
    catch (err) { notify.error("Não foi possível revogar", err instanceof Error ? err.message : undefined) }
  }

  return (
    <Modal size="lg" open={open} onOpenChange={onOpenChange} title="Conectar a extensão CORE Meet" description="A extensão grava suas reuniões do Google Meet e envia para a CORE, onde a IA escreve a ata e as tarefas.">
      <ol className="space-y-5">
        <Step n={1} title="Instale a extensão no Chrome">
          <p className="text-sm text-muted-foreground">
            Abra <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">chrome://extensions</code>, ative o <strong className="text-zinc-300">Modo do desenvolvedor</strong>, clique em <strong className="text-zinc-300">Carregar sem compactação</strong> e escolha a pasta <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">extensions/core-meet</code> deste projeto.
          </p>
        </Step>
        <Step n={2} title="Gere um token de acesso">
          {newToken ? (
            <div className="space-y-2 rounded-xl border border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] p-3">
              <p className="text-xs text-zinc-300">Copie agora — por segurança, ele não será mostrado de novo.</p>
              <CopyField value={newToken} label="token" />
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do token" placeholder="Ex.: Notebook do Bruno" className="h-10" />
              <Button onClick={create} disabled={creating} className="shrink-0">{creating ? <Loader2 className="animate-spin" /> : <KeyRound />} Gerar token</Button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </Step>
        <Step n={3} title="Cole o endereço da CORE e o token na extensão">
          <p className="text-sm text-muted-foreground">Clique no ícone da CORE Meet na barra do Chrome e informe:</p>
          <CopyField value={origin} label="endereço da CORE" />
        </Step>
        <Step n={4} title="Grave e finalize">
          <p className="text-sm text-muted-foreground">A extensão grava seu microfone e o som da reunião em faixas separadas — não precisa de legendas nem de Google Meet pago. Ao finalizar, o áudio é transcrito gratuitamente (Whisper) e a IA escreve a ata. Dica: use fone de ouvido para um áudio mais limpo.</p>
        </Step>
      </ol>

      {Boolean(tokens?.length) && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Tokens ativos</p>
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-border">
            {tokens!.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Plug className="size-4 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{t.name} <span className="font-mono text-xs text-subtle">{t.token_prefix}…</span></p>
                  <p className="text-xs text-subtle">{t.last_used_at ? `Usado em ${new Date(t.last_used_at).toLocaleString("pt-BR")}` : "Nunca usado"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke(t)} className="text-red-400 hover:text-red-300" aria-label={`Revogar ${t.name}`}><Trash2 /> Revogar</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
