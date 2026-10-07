"use client"

import { useEffect, useState } from "react"
import { Check, KeyRound, Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputField } from "@/components/core/form-fields"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

const MIN = 8

export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= MIN, label: `Pelo menos ${MIN} caracteres` },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Letras e números" },
    { ok: /[^A-Za-z0-9]/.test(pw) || pw.length >= 12, label: "Um símbolo (ou 12+ caracteres)" },
  ]
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="space-y-1" aria-label="Requisitos da senha">
      {passwordChecks(value).map((c) => (
        <li key={c.label} className={cn("flex items-center gap-2 text-xs", c.ok ? "text-emerald-400" : "text-subtle")}>
          <Check className={cn("size-3.5", !c.ok && "opacity-30")} />{c.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Troca da própria senha. Em modo obrigatório (senha provisória criada por um administrador)
 * não pode ser fechado: a pessoa troca a senha ou sai.
 */
export function ChangePasswordModal({ open, onOpenChange, forced = false }: { open: boolean; onOpenChange: (o: boolean) => void; forced?: boolean }) {
  const { passwordChanged, logout } = useAuth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setCurrent(""); setNext(""); setConfirm(""); setError(null) } }, [open])

  const mismatch = confirm.length > 0 && confirm !== next
  const valid = next.length >= MIN && next === confirm && (forced || current.length > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: forced ? undefined : current, newPassword: next }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível trocar a senha.")
      passwordChanged()
      notify.success("Senha alterada", "Use a nova senha no próximo acesso.")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      size="sm"
      open={open}
      onOpenChange={(o) => { if (!forced && !saving) onOpenChange(o) }}
      dismissible={!forced}
      title={forced ? "Defina sua nova senha" : "Alterar senha"}
      description={forced ? "Sua senha atual é provisória. Crie uma senha pessoal para continuar usando a CORE." : "Confirme a senha atual e escolha uma nova."}
    >
      <form onSubmit={submit} className="space-y-4">
        {!forced && <InputField label="Senha atual" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />}
        <InputField label="Nova senha" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
        <PasswordRules value={next} />
        <InputField label="Confirmar nova senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "As senhas não conferem." : undefined} />
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="flex justify-between gap-2 border-t border-border pt-4">
          {forced ? <Button type="button" variant="ghost" onClick={logout}><LogOut /> Sair</Button> : <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>}
          <Button type="submit" disabled={!valid || saving}>{saving ? <Loader2 className="animate-spin" /> : <KeyRound />} Salvar nova senha</Button>
        </div>
      </form>
    </Modal>
  )
}
