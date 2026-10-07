/* Formatos retornados pelas rotas /api existentes (somente leitura no front). */

export type ApiTask = {
  id: string
  kind: "tarefa" | "chamado"
  os_number: string | null
  source?: "interno" | "publico"
  client_id?: string | null
  company_name: string | null
  requester_name?: string | null
  title: string
  description?: string
  priority: "baixa" | "media" | "alta"
  status: "triagem" | "a_fazer" | "em_andamento" | "aguardando_cliente" | "concluido" | string
  due_date: string | null
  completed_at: string | null
  created_at: string
  task_attachments?: { id: string; file_name: string; public_url: string | null }[]
}

export type ApiClient = {
  id: string
  name: string
  legal_name: string | null
  document: string | null
  email?: string | null
  phone?: string | null
  support_contracts?: { plan_name: string | null; monthly_value: number | null; due_day: number | null }[]
}

export type ApiTransaction = {
  id: string
  type: "income" | "expense"
  description: string
  amount: number | string
  transaction_date: string
  status: "paid" | "pending" | string
  category?: string | null
  account_name?: string | null
}

export type ApiOpportunity = { id: string; stage: string; estimated_value: number | null }

export const isOpen = (t: ApiTask) => t.status !== "concluido"
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const isOverdue = (t: ApiTask) => isOpen(t) && Boolean(t.due_date) && t.due_date!.slice(0, 10) < todayIso()

export function taskLabel(t: ApiTask) {
  return [t.os_number, t.title || t.company_name].filter(Boolean).join(" · ")
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return "Agora"
  if (min < 60) return `Há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `Há ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `Há ${d} ${d === 1 ? "dia" : "dias"}`
  return new Date(iso).toLocaleDateString("pt-BR")
}
