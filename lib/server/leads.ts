import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase/server"

/** Select padrão do lead, com o nome do responsável. */
export const LEAD_SELECT = "*, assignee:profiles!assigned_to(id, full_name)"

export const LEAD_STAGES = ["novo_lead", "contato_realizado", "reuniao_agendada", "reuniao_realizada", "qualificado", "demo", "proposta", "negociacao", "contrato", "fechado", "perdido"] as const

/** Etapas antigas ainda aceitas (antes da migration 219). */
export const LEGACY_STAGES = ["prospeccao", "qualificacao", "ganho"] as const

const TEXT_FIELDS = ["company_name", "cnpj", "contact_name", "email", "phone", "whatsapp", "segment", "source", "city", "logo_url", "notes", "next_action", "lost_reason"] as const
const PROSPECT_STATUSES = ["primeiro_contato", "follow_up", "respondido", "sem_resposta", "qualificado", "descartado"]

/** Copia do body apenas os campos editáveis do lead (texto vazio vira null). */
export function pickLeadFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const key of TEXT_FIELDS) {
    if (body[key] === undefined) continue
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : body[key]
    data[key] = value === "" ? null : value
  }
  if (body.socios !== undefined) data.socios = Array.isArray(body.socios) ? body.socios.filter(Boolean) : []
  if (body.estimated_value !== undefined) data.estimated_value = Number(body.estimated_value) || 0
  if (body.next_action_at !== undefined) data.next_action_at = body.next_action_at || null
  if (body.assigned_to !== undefined) data.assigned_to = body.assigned_to || null
  if (body.prospect_status !== undefined) data.prospect_status = PROSPECT_STATUSES.includes(String(body.prospect_status)) ? body.prospect_status : null
  if (body.archived !== undefined) data.archived_at = body.archived ? new Date().toISOString() : null
  if (body.closed_at !== undefined) data.closed_at = body.closed_at || null
  if (body.closed_value !== undefined) data.closed_value = body.closed_value === null ? null : Number(body.closed_value) || 0
  if (body.monthly_value !== undefined) data.monthly_value = body.monthly_value === null ? null : Number(body.monthly_value) || 0
  return data
}

export async function currentProfileId(): Promise<string | null> {
  try {
    const auth = await createServerClient()
    const { data } = await auth.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

/** Registra atividade do lead. Nunca derruba a requisição principal (ex.: migration 219 ainda não aplicada). */
export async function logLeadActivity(
  supabase: SupabaseClient,
  activity: { opportunity_id: string; kind: string; description?: string | null; from_stage?: string | null; to_stage?: string | null; created_by?: string | null },
) {
  const { error } = await supabase.from("lead_activities").insert(activity)
  if (error) console.error("[core] Falha ao registrar atividade do lead:", error.message)
}
