import type React from "react"
import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "neutral" | "danger" | "info" | "primary"

const toneClass: Record<StatusTone, string> = {
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-primary/30 bg-primary/10 text-primary",
  primary: "border-primary/30 bg-primary/10 text-primary",
  neutral: "border-white/10 bg-white/[0.05] text-zinc-300",
  danger: "border-red-500/25 bg-red-500/10 text-red-300",
  info: "border-sky-400/25 bg-sky-400/10 text-sky-300",
}

const dotClass: Record<StatusTone, string> = {
  success: "bg-emerald-400",
  warning: "bg-primary",
  primary: "bg-primary",
  neutral: "bg-zinc-400",
  danger: "bg-red-400",
  info: "bg-sky-400",
}

export function StatusBadge({ tone = "neutral", dot = true, children, className }: { tone?: StatusTone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium", toneClass[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dotClass[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}

/* Mapeamentos dos status já existentes no banco (tasks) — só apresentação. */
export const taskStatusMeta: Record<string, { label: string; tone: StatusTone }> = {
  triagem: { label: "Triagem", tone: "info" },
  a_fazer: { label: "A fazer", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "warning" },
  aguardando_cliente: { label: "Aguardando cliente", tone: "neutral" },
  concluido: { label: "Concluído", tone: "success" },
}

export const priorityMeta: Record<string, { label: string; tone: StatusTone }> = {
  baixa: { label: "Baixa", tone: "neutral" },
  media: { label: "Média", tone: "warning" },
  alta: { label: "Alta", tone: "danger" },
  urgente: { label: "Urgente", tone: "danger" },
}

export function TaskStatusBadge({ status }: { status: string }) {
  const meta = taskStatusMeta[status] ?? { label: status, tone: "neutral" as const }
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta[priority] ?? { label: priority, tone: "neutral" as const }
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
