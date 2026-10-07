import type { LucideIcon } from "lucide-react"
import { ArrowRight, BadgeDollarSign, Mail, MessageCircle, NotebookPen, Pencil, Phone, Sparkles, Video } from "lucide-react"
import type { LeadActivity } from "@/lib/pipeline"

const todayIso = () => new Date().toISOString().slice(0, 10)
export const isOverdueDate = (iso: string | null | undefined) => Boolean(iso) && iso!.slice(0, 10) < todayIso()

export const activityMeta: Record<LeadActivity["kind"], { label: string; icon: LucideIcon; tone: string }> = {
  created: { label: "Lead criado", icon: Sparkles, tone: "bg-primary/10 text-primary border-primary/20" },
  stage_change: { label: "Mudança de etapa", icon: ArrowRight, tone: "bg-primary/10 text-primary border-primary/20" },
  sale: { label: "Venda finalizada", icon: BadgeDollarSign, tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  update: { label: "Dados atualizados", icon: Pencil, tone: "bg-white/[0.05] text-zinc-300 border-white/10" },
  note: { label: "Nota", icon: NotebookPen, tone: "bg-white/[0.05] text-zinc-300 border-white/10" },
  call: { label: "Ligação", icon: Phone, tone: "bg-sky-400/10 text-sky-300 border-sky-400/20" },
  email: { label: "E-mail", icon: Mail, tone: "bg-sky-400/10 text-sky-300 border-sky-400/20" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  meeting: { label: "Reunião", icon: Video, tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
}

export const MANUAL_KINDS: LeadActivity["kind"][] = ["note", "call", "whatsapp", "email", "meeting"]
