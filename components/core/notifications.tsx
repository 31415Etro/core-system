"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bell, CalendarClock, CheckCheck, Ticket } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isOpen, isOverdue, relativeTime, taskLabel, type ApiTask } from "@/components/core/api-types"
import { EmptyState } from "@/components/core/states"
import { canAccess } from "@/components/core/navigation"
import { useAuth } from "@/lib/auth-context"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

type Notice = { id: string; kind: "chamado" | "prazo" | "prioridade"; title: string; text: string; at: string; href: string }

const READ_KEY = "core-notifications-read"
const kindIcon = { chamado: Ticket, prazo: CalendarClock, prioridade: AlertTriangle }
const kindTone = { chamado: "text-primary bg-primary/10", prazo: "text-red-400 bg-red-500/10", prioridade: "text-orange-300 bg-orange-500/10" }

function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")) } catch { return new Set() }
}

/** Central de notificações derivada dos chamados/tarefas reais (lido/não lido por navegador). */
export function NotificationsButton() {
  const { user } = useAuth()
  const { data } = useApi<{ tasks: ApiTask[] }>(canAccess(user, "ordens_servico") ? "/api/tasks" : null)
  const [read, setRead] = useState<Set<string>>(new Set())
  useEffect(() => setRead(readSet()), [])

  const notices = useMemo<Notice[]>(() => {
    const tasks = data?.tasks ?? []
    const weekAgo = Date.now() - 7 * 864e5
    const list: Notice[] = []
    for (const t of tasks) {
      if (isOverdue(t)) list.push({ id: `prazo-${t.id}`, kind: "prazo", title: "Prazo vencido", text: taskLabel(t), at: t.due_date!, href: `/tickets?tarefa=${t.id}` })
      else if (isOpen(t) && t.priority === "alta") list.push({ id: `alta-${t.id}`, kind: "prioridade", title: "Prioridade alta em aberto", text: taskLabel(t), at: t.created_at, href: `/tickets?tarefa=${t.id}` })
      if (t.kind === "chamado" && new Date(t.created_at).getTime() > weekAgo) list.push({ id: `novo-${t.id}`, kind: "chamado", title: "Novo chamado aberto", text: `${taskLabel(t)}${t.company_name ? ` — ${t.company_name}` : ""}`, at: t.created_at, href: `/tickets?tarefa=${t.id}` })
    }
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)
  }, [data])

  const unread = notices.filter((n) => !read.has(n.id)).length

  function persist(next: Set<string>) {
    setRead(next)
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-300))) } catch {}
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}
        className="relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-core-gradient px-1 text-[10px] font-bold leading-4 text-black">{unread > 9 ? "9+" : unread}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <button type="button" onClick={() => persist(new Set([...read, ...notices.map((n) => n.id)]))} className="inline-flex items-center gap-1 rounded text-xs text-primary hover:text-[var(--core-yellow-soft)]">
              <CheckCheck className="size-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {notices.length === 0 ? (
            <EmptyState icon={Bell} title="Tudo em dia" description="Nenhuma notificação no momento." className="m-2 border-none" />
          ) : (
            notices.map((n) => {
              const Icon = kindIcon[n.kind]
              const isUnread = !read.has(n.id)
              return (
                <Link key={n.id} href={n.href} onClick={() => persist(new Set([...read, n.id]))} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.04]">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", kindTone[n.kind])}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", isUnread ? "font-medium text-foreground" : "text-muted-foreground")}>{n.title}</span>
                    <span className="block truncate text-xs text-subtle">{n.text}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-subtle">{relativeTime(n.at)}</span>
                    {isUnread && <span className="size-1.5 rounded-full bg-primary" aria-label="Não lida" />}
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
