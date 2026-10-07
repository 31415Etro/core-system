"use client"

import { useState, type FormEvent } from "react"
import { AlertTriangle, Loader2, Paperclip, Search, ShieldQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type TicketStatus = "triagem" | "a_fazer" | "em_andamento" | "aguardando_cliente" | "concluido"
type TicketPriority = "baixa" | "media" | "alta"
type RequestType = "nova_funcionalidade" | "manutencao" | "nova_pagina" | "ajuste"
type Ticket = {
  os_number: string; title: string; description: string; status: TicketStatus; priority: TicketPriority
  request_type: RequestType | null; estimated_window: string | null; created_at: string
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  triagem: "Em triagem",
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando você",
  concluido: "Concluído",
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  triagem: "border-white/10 bg-white/[0.04] text-zinc-300",
  a_fazer: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  em_andamento: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aguardando_cliente: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  concluido: "border-green-500/30 bg-green-500/10 text-green-400",
}

const PRIORITY_LABEL: Record<TicketPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta" }
const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  nova_funcionalidade: "Nova funcionalidade",
  manutencao: "Manutenção",
  nova_pagina: "Nova página",
  ajuste: "Ajuste",
}

const DATA_DELETION_MESSAGE = "Não realizamos exclusão de dados, solicite ao usuário admin do sistema de sua empresa."

export default function AcompanhamentoChamadosPage() {
  const [requesterName, setRequesterName] = useState("")
  const [companyPrefix, setCompanyPrefix] = useState("")
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletionOpen, setDeletionOpen] = useState(false)

  async function search(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setTickets(null)
    try {
      const response = await fetch("/api/public/tickets/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_name: requesterName.trim(), company_prefix: companyPrefix.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível consultar os chamados")
      setTickets(payload.tickets)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Não foi possível consultar os chamados")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl space-y-6 p-6">
      <header className="space-y-1 border-b pb-5 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de chamados</h1>
        <p className="text-sm text-muted-foreground">Consulte o andamento dos chamados abertos com a Gênes Technology.</p>
      </header>

      <form onSubmit={search} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Seu nome</Label>
            <Input className="mt-1" value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Nome de quem abriu o chamado" />
          </div>
          <div>
            <Label>2 primeiras letras da empresa</Label>
            <Input className="mt-1" value={companyPrefix} onChange={e => setCompanyPrefix(e.target.value)} placeholder="Ex.: MC" maxLength={2} />
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Por privacidade, só mostramos chamados quando as duas informações batem exatamente com o que foi informado na abertura do chamado.
        </p>
        <Button type="submit" className="w-full" disabled={loading || requesterName.trim().length < 2 || companyPrefix.trim().length < 2}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </Button>
      </form>

      {errorMsg && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{errorMsg}</p>}

      {tickets && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum chamado encontrado com esses dados. Confira o nome e as letras da empresa exatamente como informados na abertura do chamado.
            </p>
          ) : tickets.map(ticket => (
            <article key={ticket.os_number} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">{ticket.os_number}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold leading-snug">{ticket.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
                {ticket.request_type && <span>{REQUEST_TYPE_LABEL[ticket.request_type]}</span>}
                <span>· Prioridade {PRIORITY_LABEL[ticket.priority].toLowerCase()}</span>
                <span>· Aberto em {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {ticket.estimated_window && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                  <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />{ticket.estimated_window}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <footer className="border-t pt-4 text-center">
        <button type="button" onClick={() => setDeletionOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline">
          <ShieldQuestion className="h-3.5 w-3.5" />Exclusão de dados
        </button>
      </footer>

      <Dialog open={deletionOpen} onOpenChange={setDeletionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Exclusão de dados</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{DATA_DELETION_MESSAGE}</p>
          <DialogFooter className="sm:justify-end"><Button onClick={() => setDeletionOpen(false)}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
