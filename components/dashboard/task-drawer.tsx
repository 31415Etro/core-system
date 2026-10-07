"use client"

import Link from "next/link"
import { ExternalLink, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DetailItem, Drawer } from "@/components/core/overlays"
import { PriorityBadge, TaskStatusBadge } from "@/components/core/status-badge"
import { isOverdue, type ApiTask } from "@/components/core/api-types"

const fmtDate = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—")

/** Visualização rápida de uma tarefa/chamado sem sair do dashboard. */
export function TaskDrawer({ task, onOpenChange }: { task: ApiTask | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Drawer
      open={Boolean(task)}
      onOpenChange={onOpenChange}
      title={task ? task.title || task.os_number || "Tarefa" : ""}
      description={task ? [task.kind === "chamado" ? "Chamado" : "Tarefa", task.os_number, task.company_name].filter(Boolean).join(" · ") : undefined}
      footer={task && (
        <Button asChild>
          <Link href={`/tickets?tarefa=${task.id}`}><ExternalLink /> Abrir no kanban</Link>
        </Button>
      )}
    >
      {task && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {isOverdue(task) && <span className="inline-flex h-6 items-center rounded-full border border-red-500/25 bg-red-500/10 px-2.5 text-xs font-medium text-red-300">Atrasada</span>}
          </div>
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-white/[0.02] p-4">
            <DetailItem label="Cliente">{task.company_name || "—"}</DetailItem>
            <DetailItem label="Solicitante">{task.requester_name || "—"}</DetailItem>
            <DetailItem label="Abertura">{fmtDate(task.created_at)}</DetailItem>
            <DetailItem label="Prazo">{fmtDate(task.due_date)}</DetailItem>
            <DetailItem label="Origem">{task.source === "publico" ? "Abertura pública" : "Interno"}</DetailItem>
            <DetailItem label="Conclusão">{fmtDate(task.completed_at)}</DetailItem>
          </dl>
          {task.description && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Descrição</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{task.description}</p>
            </section>
          )}
          {Boolean(task.task_attachments?.length) && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Anexos</h3>
              <ul className="space-y-1.5">
                {task.task_attachments!.map((a) => (
                  <li key={a.id}>
                    {a.public_url ? (
                      <a href={a.public_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-white/[0.04]"><Paperclip className="size-4 text-primary" />{a.file_name}</a>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Paperclip className="size-4" />{a.file_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}
