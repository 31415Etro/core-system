"use client"

import { Building2, Target, UsersRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { StatusBadge, type StatusTone } from "@/components/core/status-badge"

export type MeetingType = "interna" | "cliente" | "lead"
export type MeetingStatus = "gravando" | "processando" | "concluida" | "erro"

export type MeetingTask = {
  id: string; title: string; description: string | null; owner: string | null; due_date: string | null
  priority: "baixa" | "media" | "alta"; scope: "avulsa" | "projeto"; client_id: string | null
  status: "sugerida" | "criada" | "ignorada"; task_id: string | null; client?: { id: string; name: string } | null
}
export type MeetingPending = { id: string; meeting_id: string; side: "nossa" | "cliente"; description: string; owner: string | null; done: boolean }
export type NextMeeting = { scheduled: boolean; date: string; time: string; agenda: string }

export type MeetingListItem = {
  id: string; type: MeetingType; title: string; status: MeetingStatus; started_at: string; ended_at: string | null
  duration_seconds: number | null; participants: string[]; summary: string | null; next_meeting: NextMeeting | null
  error: string | null; client_id: string | null; lead_id: string | null
  client: { id: string; name: string } | null; lead: { id: string; company_name: string } | null
  meeting_tasks: { id: string; status: string }[]; meeting_pending: { id: string; side: string; done: boolean }[]
  meeting_audio_parts: { id: string; track: "mic" | "tab" | "video" }[]
}

export type MeetingDetail = Omit<MeetingListItem, "meeting_tasks" | "meeting_pending"> & {
  transcript: string | null; transcript_source: string | null
  minutes: { topics: { title: string; notes: string }[]; decisions: string[]; open_questions: string[] } | null
  next_steps: string[]
  lead_insights: { pain_points: string[]; requirements: string[]; budget: string; decision_makers: string[]; objections: string[]; interest_level: string; proposal_items: string[] } | null
  ai_model: string | null; input_tokens: number | null; output_tokens: number | null; processed_at: string | null; meet_url: string | null
  lead: { id: string; company_name: string; stage: string } | null
  meeting_tasks: MeetingTask[]; meeting_pending: MeetingPending[]
}

export const TYPE_META: Record<MeetingType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  interna: { label: "Equipe interna", icon: UsersRound, tone: "neutral" },
  cliente: { label: "Cliente", icon: Building2, tone: "info" },
  lead: { label: "Lead", icon: Target, tone: "primary" },
}

const STATUS_META: Record<MeetingStatus, { label: string; tone: StatusTone }> = {
  gravando: { label: "Gravando", tone: "danger" },
  processando: { label: "IA processando", tone: "warning" },
  concluida: { label: "Ata pronta", tone: "success" },
  erro: { label: "Erro", tone: "danger" },
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.concluida
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>
}

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const m = TYPE_META[type] ?? TYPE_META.interna
  return <StatusBadge tone={m.tone} dot={false}><m.icon className="size-3" />{m.label}</StatusBadge>
}

export const fmtDuration = (s: number | null | undefined) => {
  if (!s) return "—"
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${Math.max(1, m)} min`
}
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
export const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })

export const linkedName = (m: Pick<MeetingListItem, "type" | "client" | "lead">) => (m.type === "cliente" ? m.client?.name : m.type === "lead" ? m.lead?.company_name : null) ?? null
export const linkedHref = (m: Pick<MeetingListItem, "type" | "client" | "lead">) => (m.type === "cliente" && m.client ? `/clientes-obras/${m.client.id}` : m.type === "lead" && m.lead ? `/leads/${m.lead.id}` : null)

export const hasAudio = (m: { meeting_audio_parts?: { track: string }[] }) => Boolean(m.meeting_audio_parts?.some((p) => p.track !== "video"))
export const hasVideo = (m: { meeting_audio_parts?: { track: string }[] }) => Boolean(m.meeting_audio_parts?.some((p) => p.track === "video"))

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.error || "Erro na requisição"), { code: payload.code as string | undefined })
  return payload as T
}
