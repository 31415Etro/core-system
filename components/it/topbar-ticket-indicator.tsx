"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, TicketCheck } from "lucide-react"

type Task = { kind: "tarefa" | "chamado"; priority: "baixa" | "media" | "alta"; status: string }

export function TopbarTicketIndicator() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  useEffect(() => { fetch("/api/tasks").then(r => r.json()).then(p => setTasks(p.tasks ?? [])).catch(() => setTasks([])) }, [])

  if (!tasks) return null
  const open = tasks.filter(t => t.kind === "chamado" && t.status !== "concluido").length
  const highPriority = tasks.filter(t => t.priority === "alta" && t.status !== "concluido").length

  return <Link href="/tickets" aria-label={`${open} chamados abertos; ${highPriority} de prioridade alta`} className="hidden items-center gap-3 rounded-lg border bg-card px-3 py-1.5 transition-colors hover:bg-muted/50 sm:flex">
    <span className="flex items-center gap-1.5 text-xs"><TicketCheck className="h-4 w-4 text-primary" /><strong className="tabular-nums">{open}</strong><span className="hidden text-muted-foreground lg:inline">chamados abertos</span></span>
    {highPriority > 0 && <>
      <span className="h-5 w-px bg-border" />
      <span className="flex items-center gap-1.5 text-xs"><AlertTriangle className="h-4 w-4 text-red-600" /><strong className="tabular-nums">{highPriority}</strong><span className="hidden text-muted-foreground md:inline">prioridade alta</span></span>
    </>}
  </Link>
}
