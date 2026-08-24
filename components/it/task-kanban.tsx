"use client"

import { useEffect, useMemo, useState, type DragEvent } from "react"
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Globe, Loader2, Paperclip, Plus, Search, ShieldAlert, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TaskStatus = "triagem" | "a_fazer" | "em_andamento" | "aguardando_cliente" | "concluido"
type TaskPriority = "baixa" | "media" | "alta"
type RequestType = "nova_funcionalidade" | "manutencao" | "nova_pagina" | "ajuste"
type TaskAttachment = { id: string; file_name: string; public_url: string | null; mime_type: string | null }
type Task = {
  id: string; kind: "tarefa" | "chamado"; os_number: string | null; source: "interno" | "publico"
  client_id: string | null; company_name: string | null; requester_name: string | null
  request_type: RequestType | null; cost_acknowledged: boolean | null; estimated_window: string | null
  title: string; description: string; priority: TaskPriority; status: TaskStatus
  due_date: string | null; completed_at: string | null; created_at: string; audio_transcript: string | null
  adjustment_page: string | null; in_development: boolean
  task_attachments: TaskAttachment[]
}

const columns: { id: TaskStatus; label: string; note: string }[] = [
  { id: "triagem", label: "Triagem", note: "Chamados novos a classificar" },
  { id: "a_fazer", label: "A fazer", note: "Pronto para começar" },
  { id: "em_andamento", label: "Em andamento", note: "Execução em curso" },
  { id: "aguardando_cliente", label: "Aguardando cliente", note: "Retorno ou validação" },
  { id: "concluido", label: "Concluído", note: "Finalizado" },
]

const priorityStyle: Record<TaskPriority, string> = { baixa: "border-slate-300 bg-slate-50 text-slate-700", media: "border-amber-300 bg-amber-50 text-amber-800", alta: "border-red-300 bg-red-50 text-red-700" }
const priorityLabel: Record<TaskPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta" }
const requestTypeLabel: Record<RequestType, string> = { nova_funcionalidade: "Nova funcionalidade", manutencao: "Manutenção", nova_pagina: "Nova página", ajuste: "Ajuste" }

function NewTaskForm({ onCreated }: { onCreated: (task: Task) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("media")
  const [dueDate, setDueDate] = useState("")

  async function submit() {
    if (!title.trim() || !description.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority, due_date: dueDate || null }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao criar tarefa")
      onCreated(payload.task)
      setOpen(false)
      setTitle(""); setDescription(""); setPriority("media"); setDueDate("")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar tarefa")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Nova tarefa</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova tarefa interna</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div><Label>Título</Label><Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito" /></div>
        <div><Label>Descrição</Label><Textarea className="mt-1" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da tarefa" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Prioridade</Label><Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
          <div><Label>Prazo (opcional)</Label><Input className="mt-1" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={submit} disabled={saving || !title.trim() || !description.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Criar tarefa</Button></div>
      </div>
    </DialogContent>
  </Dialog>
}

function TaskCard({ task, onOpen, onDragStart, onStatusChange }: {
  task: Task; onOpen: () => void; onDragStart: (event: DragEvent) => void; onStatusChange: (status: TaskStatus) => void
}) {
  return <article draggable onDragStart={onDragStart} className="group cursor-grab rounded-xl border bg-background p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing active:scale-[.99]">
    <div className="flex items-start justify-between gap-2">
      <span className="font-mono text-xs font-semibold text-muted-foreground">{task.os_number ?? "Tarefa interna"}</span>
      {task.source === "publico" && <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
    </div>
    <button onClick={onOpen} className="mt-2 block w-full text-left">
      <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
      {task.company_name && <p className="mt-1 text-xs font-medium text-primary">{task.company_name}</p>}
    </button>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <Badge variant="outline" className={priorityStyle[task.priority]}>{task.priority === "alta" && <AlertTriangle />}{priorityLabel[task.priority]}</Badge>
      {task.request_type && <Badge variant="secondary">{requestTypeLabel[task.request_type]}</Badge>}
      {task.task_attachments.length > 0 && <Badge variant="outline"><Paperclip />{task.task_attachments.length}</Badge>}
    </div>
    {(task.requester_name || task.adjustment_page) && <div className="mt-3 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
      {task.requester_name && <p className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{task.requester_name}</p>}
      {task.adjustment_page && <p className="truncate">Página: {task.adjustment_page}{task.in_development && " · Em desenvolvimento"}</p>}
    </div>}
    <div className="mt-3 border-t pt-3" onClick={e => e.stopPropagation()}>
      <Select value={task.status} onValueChange={v => onStatusChange(v as TaskStatus)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </article>
}

function TaskDetail({ task, open, onOpenChange }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!task) return null
  const photos = task.task_attachments.filter(file => !file.mime_type?.startsWith("audio/"))
  const audios = task.task_attachments.filter(file => file.mime_type?.startsWith("audio/"))
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{task.os_number ?? "Tarefa interna"}</span>
          <Badge variant="outline" className={priorityStyle[task.priority]}>{priorityLabel[task.priority]}</Badge>
          {task.request_type && <Badge variant="secondary">{requestTypeLabel[task.request_type]}</Badge>}
        </div>
        <DialogTitle className="text-2xl leading-tight">{task.title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          <section><h3 className="text-sm font-semibold">Descrição</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{task.description}</p></section>
          {task.estimated_window && <section><h3 className="text-sm font-semibold">Prazo estimado</h3><div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">{task.estimated_window}</div></section>}
          {task.request_type === "ajuste" && task.adjustment_page && (
            <section><h3 className="text-sm font-semibold">Página do ajuste</h3><div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">{task.adjustment_page}</div></section>
          )}
          {task.request_type === "ajuste" && task.in_development && (
            <section className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cliente informou que o projeto está em desenvolvimento (direito a até 3 ajustes por página sem custo).</p>
            </section>
          )}
          {(task.request_type === "nova_funcionalidade" || task.request_type === "ajuste") && (
            <section className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${task.cost_acknowledged ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-800"}`}>
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Ciência do custo adicional: <strong>{task.cost_acknowledged ? "Sim" : "Não"}</strong></p>
            </section>
          )}
          <section>
            <h3 className="text-sm font-semibold">Fotos anexadas</h3>
            {photos.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {photos.map(file => (
                  <a key={file.id} href={file.public_url ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                    {file.public_url && <img src={file.public_url} alt={file.file_name} className="h-28 w-full object-cover" />}
                  </a>
                ))}
              </div>
            ) : <p className="mt-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma foto anexada.</p>}
          </section>
          {(audios.length > 0 || task.audio_transcript) && (
            <section>
              <h3 className="text-sm font-semibold">Áudio do chamado</h3>
              {audios.map(file => (
                <audio key={file.id} controls src={file.public_url ?? undefined} className="mt-2 w-full" />
              ))}
              {task.audio_transcript && (
                <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Transcrição</p>
                  {task.audio_transcript}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="space-y-4 rounded-xl border bg-muted/20 p-4">
          {task.company_name && <div><p className="text-xs text-muted-foreground">Empresa</p><p className="mt-1 text-sm font-semibold">{task.company_name}</p></div>}
          {task.requester_name && <div><p className="text-xs text-muted-foreground">Autor do chamado</p><p className="mt-1 text-sm font-semibold">{task.requester_name}</p></div>}
          <div><p className="text-xs text-muted-foreground">Aberto em</p><p className="mt-1 text-sm font-medium">{new Date(task.created_at).toLocaleString("pt-BR")}</p></div>
          {task.due_date && <div><p className="text-xs text-muted-foreground">Prazo</p><p className="mt-1 text-sm font-medium">{new Date(task.due_date).toLocaleDateString("pt-BR")}</p></div>}
          {task.completed_at && <div><p className="text-xs text-muted-foreground">Concluída em</p><p className="mt-1 text-sm font-medium">{new Date(task.completed_at).toLocaleString("pt-BR")}</p></div>}
          <div><p className="text-xs text-muted-foreground">Origem</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium">{task.source === "publico" ? <><Globe className="h-4 w-4" />Chamado externo</> : "Tarefa interna"}</p></div>
        </aside>
      </div>
    </DialogContent>
  </Dialog>
}

export function TicketKanban() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)
  const [query, setQuery] = useState("")
  const [priority, setPriority] = useState("all")

  useEffect(() => {
    fetch("/api/tasks")
      .then(response => response.json())
      .then(payload => setTasks(payload.tasks ?? []))
      .catch(() => setErrorMsg("Não foi possível carregar as tarefas."))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () => tasks.filter(task => (priority === "all" || task.priority === priority) &&
      `${task.os_number ?? ""} ${task.company_name ?? ""} ${task.title} ${task.requester_name ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [tasks, query, priority],
  )

  async function moveTask(id: string, status: TaskStatus) {
    const previous = tasks
    setTasks(current => current.map(t => (t.id === id ? { ...t, status } : t)))
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error("Falha ao mover tarefa")
      const payload = await response.json()
      setTasks(current => current.map(t => (t.id === id ? payload.task : t)))
    } catch {
      setTasks(previous)
    }
  }

  function drop(status: TaskStatus) {
    const id = dragged
    setDragged(null); setOver(null)
    if (id) moveTask(id, status)
  }

  if (loading) return <div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (errorMsg) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{errorMsg}</div>

  return <>
    <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar OS, empresa, título ou solicitante" /></div>
      <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as prioridades</SelectItem><SelectItem value="alta">Prioridade alta</SelectItem><SelectItem value="media">Prioridade média</SelectItem><SelectItem value="baixa">Prioridade baixa</SelectItem></SelectContent></Select>
      <NewTaskForm onCreated={task => setTasks(current => [task, ...current])} />
    </div>
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map(column => {
        const items = visible.filter(task => task.status === column.id)
        return <section
          key={column.id}
          onDragOver={event => { event.preventDefault(); setOver(column.id) }}
          onDragLeave={() => setOver(null)}
          onDrop={() => drop(column.id)}
          className={`min-h-[520px] min-w-[280px] flex-1 rounded-xl border bg-muted/20 transition ${over === column.id ? "border-primary bg-primary/5 ring-2 ring-primary/15" : ""}`}
        >
          <header className="sticky top-0 z-10 rounded-t-xl border-b bg-background/95 p-3 backdrop-blur">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{column.label}</h2><span className="grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1.5 text-xs font-semibold">{items.length}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{column.note}</p>
          </header>
          <div className="space-y-3 p-3">
            {items.map(task => <TaskCard key={task.id} task={task} onOpen={() => setSelected(task)} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; setDragged(task.id) }} onStatusChange={status => moveTask(task.id, status)} />)}
            {!items.length && <div className="grid min-h-28 place-items-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">Arraste uma tarefa para esta etapa</div>}
          </div>
        </section>
      })}
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Arraste ou use o seletor no card para mudar de etapa</span>
      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Persistido no Supabase</span>
    </div>
    <TaskDetail task={selected} open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null) }} />
  </>
}
