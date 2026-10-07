import type { StatusTone } from "@/components/core/status-badge"

/** Etapas do pipeline CORE, na ordem da jornada comercial. */
export const PIPELINE_STAGES = [
  { id: "novo_lead", label: "Novo lead", tone: "info" },
  { id: "contato_realizado", label: "Contato realizado", tone: "neutral" },
  { id: "reuniao_agendada", label: "Reunião agendada", tone: "neutral" },
  { id: "reuniao_realizada", label: "Reunião realizada", tone: "neutral" },
  { id: "qualificado", label: "Qualificado", tone: "warning" },
  { id: "demo", label: "Demo", tone: "warning" },
  { id: "proposta", label: "Proposta", tone: "warning" },
  { id: "negociacao", label: "Negociação", tone: "warning" },
  { id: "contrato", label: "Contrato", tone: "primary" },
  { id: "fechado", label: "Fechado", tone: "success" },
  { id: "perdido", label: "Perdido", tone: "danger" },
] as const satisfies readonly { id: string; label: string; tone: StatusTone }[]

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"]

export const STAGE_IDS = PIPELINE_STAGES.map((s) => s.id) as PipelineStage[]

/** Valores antigos (antes da migration 219) continuam sendo reconhecidos. */
const LEGACY: Record<string, PipelineStage> = {
  prospeccao: "novo_lead",
  qualificacao: "qualificado",
  ganho: "fechado",
  contato: "contato_realizado",
  reuniao: "reuniao_agendada",
  proposta_enviada: "proposta",
  venda: "fechado",
  onboarding: "fechado",
  cliente_ativo: "fechado",
}

export function normalizeStage(stage: string | null | undefined): PipelineStage {
  if (!stage) return "novo_lead"
  if ((STAGE_IDS as string[]).includes(stage)) return stage as PipelineStage
  return LEGACY[stage] ?? "novo_lead"
}

export const stageMeta = (stage: string | null | undefined) => PIPELINE_STAGES.find((s) => s.id === normalizeStage(stage))!

export const isWonStage = (stage: string | null | undefined) => normalizeStage(stage) === "fechado"
export const isLostStage = (stage: string | null | undefined) => normalizeStage(stage) === "perdido"
export const isOpenStage = (stage: string | null | undefined) => !isWonStage(stage) && !isLostStage(stage)

/** Status de contato usados na aba Prospecção (leads em abordagem inicial). */
export const PROSPECT_STATUSES = [
  { id: "primeiro_contato", label: "Primeiro contato", tone: "info" },
  { id: "follow_up", label: "Follow-up", tone: "warning" },
  { id: "respondido", label: "Respondido", tone: "success" },
  { id: "sem_resposta", label: "Sem resposta", tone: "neutral" },
  { id: "qualificado", label: "Qualificado", tone: "success" },
  { id: "descartado", label: "Descartado", tone: "danger" },
] as const satisfies readonly { id: string; label: string; tone: StatusTone }[]
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]["id"]
/** Etapas consideradas "abordagem inicial" (aba Prospecção). */
export const PROSPECTING_STAGES: PipelineStage[] = ["novo_lead", "contato_realizado"]

export const LEAD_SOURCES = ["Indicação", "Site", "Instagram", "LinkedIn", "WhatsApp", "Google", "Evento", "Prospecção ativa", "Base CNAE", "Outro"]
export const LEAD_SEGMENTS = ["Climatização", "Indústria", "Comércio", "Serviços", "Saúde", "Jurídico", "Imobiliário", "Educação", "Tecnologia", "Construção", "Outro"]

export type Lead = {
  id: string
  company_name: string
  cnpj: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  whatsapp?: string | null
  segment?: string | null
  city?: string | null
  prospect_status?: string | null
  archived_at?: string | null
  last_activity_at?: string | null
  source?: string | null
  logo_url?: string | null
  socios?: string[] | null
  stage: string
  estimated_value: number | null
  assigned_to: string | null
  assignee?: { id: string; full_name: string } | null
  notes: string | null
  next_action?: string | null
  next_action_at: string | null
  lost_reason?: string | null
  closed_at?: string | null
  closed_value?: number | null
  monthly_value?: number | null
  stage_changed_at?: string | null
  client_id?: string | null
  created_at: string
  updated_at?: string
}

export type LeadActivity = {
  id: string
  opportunity_id: string
  kind: "created" | "stage_change" | "update" | "note" | "call" | "email" | "whatsapp" | "meeting" | "sale"
  description: string | null
  from_stage: string | null
  to_stage: string | null
  created_at: string
  author?: { full_name: string } | null
  lead?: { id: string; company_name: string } | null
}

export type TeamMember = { id: string; full_name: string; email: string; role: string }

export function daysInStage(lead: Lead) {
  const since = lead.stage_changed_at || lead.updated_at || lead.created_at
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 864e5))
}

export function whatsappLink(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "")
  if (!digits) return null
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
}
