"use client"

import { useEffect, useMemo, useState, type DragEvent } from "react"
import { Building2, CalendarClock, CheckCircle2, Loader2, Plus, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { brl } from "@/lib/it-service-data"

type Stage = "prospeccao" | "qualificacao" | "proposta" | "negociacao" | "ganho" | "perdido"
type Opportunity = {
  id: string; company_name: string; cnpj: string | null; contact_name: string | null; email: string | null; phone: string | null
  socios: string[]; stage: Stage; estimated_value: number; notes: string | null; next_action_at: string | null; created_at: string
}

const columns: { id: Stage; label: string }[] = [
  { id: "prospeccao", label: "Prospecção" },
  { id: "qualificacao", label: "Qualificação" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
]

function parseSocios(value: string) {
  return value.split(",").map(s => s.trim()).filter(Boolean)
}

function OpportunityFields({ values, onChange }: {
  values: { companyName: string; cnpj: string; contactName: string; email: string; phone: string; socios: string; estimatedValue: string; notes: string }
  onChange: (patch: Partial<typeof values>) => void
}) {
  return <div className="grid gap-4">
    <div><Label>Empresa</Label><Input className="mt-1" value={values.companyName} onChange={e => onChange({ companyName: e.target.value })} placeholder="Nome da empresa" /></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div><Label>CNPJ</Label><Input className="mt-1" value={values.cnpj} onChange={e => onChange({ cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
      <div><Label>Valor estimado</Label><Input className="mt-1" type="number" value={values.estimatedValue} onChange={e => onChange({ estimatedValue: e.target.value })} placeholder="0" /></div>
      <div><Label>Contato</Label><Input className="mt-1" value={values.contactName} onChange={e => onChange({ contactName: e.target.value })} placeholder="Nome do contato" /></div>
      <div><Label>Telefone</Label><Input className="mt-1" value={values.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="(47) 90000-0000" /></div>
      <div><Label>E-mail</Label><Input className="mt-1" value={values.email} onChange={e => onChange({ email: e.target.value })} placeholder="contato@empresa.com" /></div>
      <div><Label>Sócios</Label><Input className="mt-1" value={values.socios} onChange={e => onChange({ socios: e.target.value })} placeholder="Nome do sócio, separado por vírgula" /></div>
    </div>
    <div><Label>Notas</Label><Input className="mt-1" value={values.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Observações" /></div>
  </div>
}

const emptyFields = { companyName: "", cnpj: "", contactName: "", email: "", phone: "", socios: "", estimatedValue: "", notes: "" }

function NewOpportunityForm({ onCreated }: { onCreated: (opportunity: Opportunity) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState(emptyFields)

  async function submit() {
    if (!values.companyName.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/commercial-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: values.companyName,
          cnpj: values.cnpj || null,
          contact_name: values.contactName || null,
          email: values.email || null,
          phone: values.phone || null,
          socios: parseSocios(values.socios),
          estimated_value: Number(values.estimatedValue) || 0,
          notes: values.notes || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao criar oportunidade")
      onCreated(payload.opportunity)
      setOpen(false)
      setValues(emptyFields)
    } catch (error) {
      console.error("[v0] Error creating opportunity:", error)
      alert(error instanceof Error ? error.message : "Erro ao criar oportunidade")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Nova oportunidade</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova oportunidade comercial</DialogTitle></DialogHeader>
      <OpportunityFields values={values} onChange={patch => setValues(current => ({ ...current, ...patch }))} />
      <div className="flex justify-end"><Button onClick={submit} disabled={saving || !values.companyName.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button></div>
    </DialogContent>
  </Dialog>
}

function OpportunityDetail({ opportunity, onOpenChange, onSaved }: {
  opportunity: Opportunity | null; onOpenChange: (open: boolean) => void; onSaved: (opportunity: Opportunity) => void
}) {
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState(emptyFields)

  useEffect(() => {
    if (!opportunity) return
    setValues({
      companyName: opportunity.company_name,
      cnpj: opportunity.cnpj ?? "",
      contactName: opportunity.contact_name ?? "",
      email: opportunity.email ?? "",
      phone: opportunity.phone ?? "",
      socios: (opportunity.socios ?? []).join(", "),
      estimatedValue: String(opportunity.estimated_value ?? 0),
      notes: opportunity.notes ?? "",
    })
  }, [opportunity])

  async function submit() {
    if (!opportunity || !values.companyName.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/commercial-opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: values.companyName,
          cnpj: values.cnpj || null,
          contact_name: values.contactName || null,
          email: values.email || null,
          phone: values.phone || null,
          socios: parseSocios(values.socios),
          estimated_value: Number(values.estimatedValue) || 0,
          notes: values.notes || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar oportunidade")
      onSaved(payload.opportunity)
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error saving opportunity:", error)
      alert(error instanceof Error ? error.message : "Erro ao salvar oportunidade")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={Boolean(opportunity)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Editar oportunidade</DialogTitle></DialogHeader>
      <OpportunityFields values={values} onChange={patch => setValues(current => ({ ...current, ...patch }))} />
      <div className="flex justify-end"><Button onClick={submit} disabled={saving || !values.companyName.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar alterações</Button></div>
    </DialogContent>
  </Dialog>
}

function OpportunityCard({ opportunity, onOpen, onDragStart }: { opportunity: Opportunity; onOpen: () => void; onDragStart: (event: DragEvent) => void }) {
  const overdue = opportunity.next_action_at ? new Date(opportunity.next_action_at) < new Date() : false
  return <article draggable onDragStart={onDragStart} onClick={onOpen} className="cursor-grab rounded-xl border bg-background p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing active:scale-[.99]">
    <p className="text-sm font-semibold leading-snug">{opportunity.company_name}</p>
    {opportunity.cnpj && <p className="mt-0.5 text-xs text-muted-foreground">{opportunity.cnpj}</p>}
    {opportunity.contact_name && <p className="mt-1 text-xs text-muted-foreground">{opportunity.contact_name}{opportunity.phone ? ` · ${opportunity.phone}` : ""}</p>}
    {opportunity.socios.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{opportunity.socios.join(", ")}</p>}
    <p className="mt-2 text-sm font-medium text-primary">{brl(opportunity.estimated_value)}</p>
    {opportunity.next_action_at && <p className={`mt-2 text-xs ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>Próxima ação: {new Date(opportunity.next_action_at).toLocaleDateString("pt-BR")}</p>}
  </article>
}

export function CommercialKanban() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Opportunity | null>(null)

  useEffect(() => {
    fetch("/api/commercial-opportunities")
      .then(response => response.json())
      .then(payload => setOpportunities(payload.opportunities ?? []))
      .catch(error => {
        console.error("[v0] Error loading opportunities:", error)
        setErrorMsg("Não foi possível carregar as oportunidades.")
      })
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () => opportunities.filter(o => `${o.company_name} ${o.contact_name ?? ""} ${o.cnpj ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [opportunities, query],
  )

  async function drop(stage: Stage) {
    const id = dragged
    setDragged(null); setOver(null)
    if (!id) return
    const previous = opportunities
    setOpportunities(current => current.map(o => (o.id === id ? { ...o, stage } : o)))
    try {
      const response = await fetch(`/api/commercial-opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      })
      if (!response.ok) throw new Error("Falha ao mover oportunidade")
    } catch (error) {
      console.error("[v0] Error moving opportunity:", error)
      setOpportunities(previous)
    }
  }

  if (loading) return <div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (errorMsg) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{errorMsg}</div>

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empresa, contato ou CNPJ" /></div>
      <NewOpportunityForm onCreated={opportunity => setOpportunities(current => [opportunity, ...current])} />
    </div>
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map(column => {
        const items = visible.filter(o => o.stage === column.id)
        return <section
          key={column.id}
          onDragOver={event => { event.preventDefault(); setOver(column.id) }}
          onDragLeave={() => setOver(null)}
          onDrop={() => drop(column.id)}
          className={`min-h-[420px] min-w-[240px] flex-1 rounded-xl border bg-muted/20 transition ${over === column.id ? "border-primary bg-primary/5 ring-2 ring-primary/15" : ""}`}
        >
          <header className="sticky top-0 z-10 rounded-t-xl border-b bg-background/95 p-3 backdrop-blur">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{column.label}</h2><span className="grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1.5 text-xs font-semibold">{items.length}</span></div>
          </header>
          <div className="space-y-3 p-3">
            {items.map(opportunity => <OpportunityCard key={opportunity.id} opportunity={opportunity} onOpen={() => setSelected(opportunity)} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; setDragged(opportunity.id) }} />)}
            {!items.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed text-center text-xs text-muted-foreground"><Building2 className="mx-auto mb-1 h-4 w-4" />Arraste uma oportunidade</div>}
          </div>
        </section>
      })}
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Ordenação manual por drag and drop · clique num card para editar</span>
      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Persistido no Supabase</span>
    </div>
    <OpportunityDetail
      opportunity={selected}
      onOpenChange={open => { if (!open) setSelected(null) }}
      onSaved={updated => { setOpportunities(current => current.map(o => (o.id === updated.id ? updated : o))); setSelected(null) }}
    />
  </div>
}
