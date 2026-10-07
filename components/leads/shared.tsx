"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormSection, InputField, SelectField, TextareaField } from "@/components/core/form-fields"
import { notify } from "@/components/core/notify"
import { Modal } from "@/components/core/overlays"
import { StatusBadge } from "@/components/core/status-badge"
import { LEAD_SEGMENTS, LEAD_SOURCES, PIPELINE_STAGES, stageMeta, type Lead, type TeamMember } from "@/lib/pipeline"
import { invalidateApi, useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export function useTeam() {
  const { data } = useApi<{ team: TeamMember[] }>("/api/team")
  return data?.team ?? []
}

export async function patchLead(id: string, patch: Record<string, unknown>): Promise<Lead> {
  const response = await fetch(`/api/commercial-opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "Erro ao atualizar lead")
  invalidateApi("/api/commercial-opportunities")
  return payload.opportunity
}

export function LeadAvatar({ lead, size = "md", className }: { lead: Pick<Lead, "company_name" | "logo_url">; size?: "sm" | "md" | "lg"; className?: string }) {
  const [broken, setBroken] = useState(false)
  const dims = size === "lg" ? "size-14 rounded-2xl text-base" : size === "sm" ? "size-8 rounded-lg text-[11px]" : "size-10 rounded-xl text-xs"
  const initials = lead.company_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
  if (lead.logo_url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={lead.logo_url} alt="" onError={() => setBroken(true)} className={cn("shrink-0 border border-white/10 bg-white object-contain p-1", dims, className)} />
  }
  return <span className={cn("grid shrink-0 place-items-center border border-primary/20 bg-primary/10 font-semibold text-primary", dims, className)} aria-hidden="true">{initials}</span>
}

export function StageBadge({ stage }: { stage: string }) {
  const meta = stageMeta(stage)
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

const NONE = "__none"
type FormValues = {
  company_name: string; cnpj: string; segment: string; city: string; logo_url: string
  contact_name: string; phone: string; whatsapp: string; email: string; socios: string
  assigned_to: string; source: string; estimated_value: string; stage: string
  next_action: string; next_action_at: string; notes: string
}

function toValues(lead?: Lead | null): FormValues {
  return {
    company_name: lead?.company_name ?? "", cnpj: lead?.cnpj ?? "", segment: lead?.segment ?? NONE, city: lead?.city ?? "", logo_url: lead?.logo_url ?? "",
    contact_name: lead?.contact_name ?? "", phone: lead?.phone ?? "", whatsapp: lead?.whatsapp ?? "", email: lead?.email ?? "", socios: (lead?.socios ?? []).join(", "),
    assigned_to: lead?.assigned_to ?? NONE, source: lead?.source ?? NONE, estimated_value: lead?.estimated_value ? String(lead.estimated_value) : "", stage: lead ? stageMeta(lead.stage).id : "novo_lead",
    next_action: lead?.next_action ?? "", next_action_at: lead?.next_action_at ? lead.next_action_at.slice(0, 10) : "", notes: lead?.notes ?? "",
  }
}

/** Cadastro/edição de lead em seções (empresa, contato, comercial). */
export function LeadFormModal({ open, onOpenChange, lead, team, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; lead?: Lead | null; team: TeamMember[]; onSaved: (lead: Lead) => void }) {
  const [values, setValues] = useState<FormValues>(() => toValues(lead))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = Boolean(lead)

  useEffect(() => { if (open) { setValues(toValues(lead)); setError(null) } }, [open, lead])

  const set = (key: keyof FormValues) => (v: string) => setValues((cur) => ({ ...cur, [key]: v }))
  const input = (key: keyof FormValues) => ({ value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value) })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.company_name.trim()) { setError("Informe o nome da empresa"); return }
    setSaving(true)
    const body = {
      company_name: values.company_name, cnpj: values.cnpj, segment: values.segment === NONE ? "" : values.segment, city: values.city, logo_url: values.logo_url,
      contact_name: values.contact_name, phone: values.phone, whatsapp: values.whatsapp, email: values.email,
      socios: values.socios.split(",").map((s) => s.trim()).filter(Boolean),
      assigned_to: values.assigned_to === NONE ? null : values.assigned_to, source: values.source === NONE ? "" : values.source,
      estimated_value: Number(values.estimated_value.replace(/\./g, "").replace(",", ".")) || 0,
      next_action: values.next_action, next_action_at: values.next_action_at || null, notes: values.notes,
      ...(editing && values.stage !== stageMeta(lead!.stage).id ? { stage: values.stage } : {}),
    }
    try {
      let saved: Lead
      if (editing) {
        saved = await patchLead(lead!.id, body)
      } else {
        const response = await fetch("/api/commercial-opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Erro ao criar lead")
        invalidateApi("/api/commercial-opportunities")
        saved = payload.opportunity
      }
      notify.success(editing ? "Lead atualizado" : "Lead criado", saved.company_name)
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      notify.error(editing ? "Erro ao atualizar lead" : "Erro ao criar lead", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const teamOptions = [{ value: NONE, label: "Sem responsável" }, ...team.map((m) => ({ value: m.id, label: m.full_name }))]
  if (lead?.assigned_to && !team.some((m) => m.id === lead.assigned_to)) teamOptions.push({ value: lead.assigned_to, label: lead.assignee?.full_name ?? "Responsável atual" })

  return (
    <Modal
      size="xl"
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Editar ${lead!.company_name}` : "Novo lead"}
      description={editing ? "Atualize os dados do lead." : "Cadastre a empresa e o contato. O lead entra no pipeline como “Novo lead”."}
    >
      <form id="lead-form" onSubmit={submit} className="space-y-7">
        <FormSection title="Empresa" columns={3}>
          <InputField label="Nome da empresa" required fieldClassName="sm:col-span-2" placeholder="Ex.: Mineirão Climatização" error={error ?? undefined} {...input("company_name")} />
          <InputField label="CNPJ" placeholder="00.000.000/0001-00" {...input("cnpj")} />
          <SelectField label="Segmento" value={values.segment} onValueChange={set("segment")} options={[{ value: NONE, label: "Não informado" }, ...LEAD_SEGMENTS.map((s) => ({ value: s, label: s }))]} />
          <InputField label="Cidade" placeholder="Ex.: Joinville / SC" {...input("city")} />
          <InputField label="URL do logo" placeholder="https://..." helper="Opcional — aparece no pipeline e na página do lead" {...input("logo_url")} />
        </FormSection>

        <FormSection title="Contato" columns={3}>
          <InputField label="Nome do contato" placeholder="Quem decide ou acompanha" {...input("contact_name")} />
          <InputField label="Telefone" placeholder="(47) 3000-0000" {...input("phone")} />
          <InputField label="WhatsApp" placeholder="(47) 90000-0000" {...input("whatsapp")} />
          <InputField label="E-mail" type="email" placeholder="contato@empresa.com" fieldClassName="sm:col-span-2" {...input("email")} />
          <InputField label="Sócios" placeholder="Separe por vírgula" {...input("socios")} />
        </FormSection>

        <FormSection title="Comercial" columns={3}>
          <SelectField label="Responsável comercial" value={values.assigned_to} onValueChange={set("assigned_to")} options={teamOptions} />
          <SelectField label="Origem" value={values.source} onValueChange={set("source")} options={[{ value: NONE, label: "Não informada" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]} />
          <InputField label="Valor estimado (R$)" inputMode="decimal" placeholder="0,00" {...input("estimated_value")} />
          {editing && <SelectField label="Etapa" value={values.stage} onValueChange={set("stage")} options={PIPELINE_STAGES.map((s) => ({ value: s.id, label: s.label }))} />}
          <InputField label="Próxima atividade" placeholder="Ex.: Ligar para agendar reunião" fieldClassName={editing ? "" : "sm:col-span-2"} {...input("next_action")} />
          <InputField label="Data da próxima atividade" type="date" {...input("next_action_at")} />
          <TextareaField label="Observações" fieldClassName="sm:col-span-2 lg:col-span-3" placeholder="Contexto, necessidades, histórico..." {...input("notes")} />
        </FormSection>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{editing ? "Salvar alterações" : "Criar lead"}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Confirmação ao mover para "Perdido" — motivo opcional, registrado no histórico. */
export function LostReasonModal({ lead, onCancel, onConfirm }: { lead: Lead | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("")
  useEffect(() => { if (lead) setReason(lead.lost_reason ?? "") }, [lead])
  return (
    <Modal
      size="sm"
      open={Boolean(lead)}
      onOpenChange={(o) => { if (!o) onCancel() }}
      title="Marcar como perdido"
      description={lead ? `${lead.company_name} sai do funil ativo. O motivo fica no histórico do lead.` : undefined}
      footer={<><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button variant="destructive" onClick={() => onConfirm(reason)}>Marcar como perdido</Button></>}
    >
      <TextareaField label="Motivo da perda" placeholder="Ex.: preço, timing, escolheu concorrente..." value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  )
}

/** Finalizar venda: o lead vai para "Fechado" e a venda fica registrada no próprio lead. */
export function CloseDealModal({ lead, onCancel, onConfirm }: { lead: Lead | null; onCancel: () => void; onConfirm: (data: { closed_value: number; monthly_value: number; closed_at: string }) => void }) {
  const [setup, setSetup] = useState("")
  const [monthly, setMonthly] = useState("")
  const [date, setDate] = useState("")
  useEffect(() => {
    if (!lead) return
    setSetup(String(lead.closed_value ?? lead.estimated_value ?? ""))
    setMonthly(lead.monthly_value ? String(lead.monthly_value) : "")
    setDate(lead.closed_at ?? new Date().toISOString().slice(0, 10))
  }, [lead])
  const num = (v: string) => Number(v.replace(/./g, "").replace(",", ".")) || 0
  return (
    <Modal
      size="sm"
      open={Boolean(lead)}
      onOpenChange={(o) => { if (!o) onCancel() }}
      title="Finalizar venda"
      description={lead ? `${lead.company_name} passa para Fechado / Cliente. Os valores ficam registrados no lead.` : undefined}
      footer={<><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={() => onConfirm({ closed_value: num(setup), monthly_value: num(monthly), closed_at: date })}>Finalizar venda</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Valor de implantação (R$)" inputMode="decimal" value={setup} onChange={(e) => setSetup(e.target.value)} />
        <InputField label="Mensalidade (R$)" inputMode="decimal" placeholder="0,00" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <InputField label="Data de fechamento" type="date" value={date} onChange={(e) => setDate(e.target.value)} fieldClassName="sm:col-span-2" helper="Na Fase 4 isto acontece automaticamente ao assinar o contrato, gerando cliente, projeto e financeiro." />
      </div>
    </Modal>
  )
}

/**
 * Mudança de etapa compartilhada (pipeline, lista, página do lead): otimista,
 * pede motivo ao perder e abre "Finalizar venda" ao fechar.
 */
export function useStageMove(onChange: (lead: Lead) => void) {
  const [losing, setLosing] = useState<Lead | null>(null)
  const [closing, setClosing] = useState<Lead | null>(null)

  async function move(lead: Lead, stage: string, extra: Record<string, unknown> = {}) {
    onChange({ ...lead, ...extra, stage, stage_changed_at: new Date().toISOString() } as Lead)
    try {
      const saved = await patchLead(lead.id, { stage, ...extra })
      onChange({ ...lead, ...saved })
      notify.success(stage === "fechado" ? "Venda finalizada" : "Etapa atualizada", `${lead.company_name} → ${stageMeta(stage).label}`)
    } catch (err) {
      onChange(lead)
      notify.error("Não foi possível mudar a etapa", err instanceof Error ? err.message : undefined)
    }
  }

  function requestMove(lead: Lead, stage: string) {
    if (stageMeta(lead.stage).id === stage) return
    if (stage === "perdido") setLosing(lead)
    else if (stage === "fechado") setClosing(lead)
    else move(lead, stage)
  }

  const modals = (
    <>
      <LostReasonModal lead={losing} onCancel={() => setLosing(null)} onConfirm={(reason) => { const l = losing!; setLosing(null); move(l, "perdido", { lost_reason: reason }) }} />
      <CloseDealModal lead={closing} onCancel={() => setClosing(null)} onConfirm={(data) => { const l = closing!; setClosing(null); move(l, "fechado", data) }} />
    </>
  )
  return { requestMove, modals }
}

export async function setArchived(lead: Lead, archived: boolean, onChange: (lead: Lead) => void) {
  onChange({ ...lead, archived_at: archived ? new Date().toISOString() : null })
  try {
    const saved = await patchLead(lead.id, { archived })
    onChange({ ...lead, ...saved })
    notify.success(archived ? "Lead arquivado" : "Lead restaurado", lead.company_name)
  } catch (err) {
    onChange(lead)
    notify.error("Não foi possível arquivar", err instanceof Error ? err.message : undefined)
  }
}
