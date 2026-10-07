"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { List, MapPinned } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { relativeTime } from "@/components/core/api-types"
import { DataTable, type DataTableColumn } from "@/components/core/data-table"
import { notify } from "@/components/core/notify"
import { Skeleton } from "@/components/core/states"
import { LeadAvatar, patchLead } from "@/components/leads/shared"
import { isOverdueDate } from "@/components/leads/utils"
import { PROSPECT_STATUSES, PROSPECTING_STAGES, normalizeStage, type Lead } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

const ProspectMap = dynamic(() => import("@/components/commercial/prospect-map").then((m) => m.ProspectMap), { ssr: false, loading: () => <Skeleton className="h-[520px] rounded-[20px]" /> })

const ALL = "all"
const NONE = "__none"
const dotTone: Record<string, string> = { info: "bg-sky-400", warning: "bg-primary", success: "bg-emerald-400", neutral: "bg-zinc-500", danger: "bg-red-400" }

/** Leads em abordagem inicial (Novo lead / Contato realizado) + mapa CNAE para encontrar novas empresas. */
export function ProspectingView({ leads, loading, ownerName, onChange }: { leads: Lead[]; loading: boolean; ownerName: (l: Lead) => string | null; onChange: (lead: Lead) => void }) {
  const router = useRouter()
  const [view, setView] = useState<"fila" | "mapa">("fila")
  const [city, setCity] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  const prospecting = leads.filter((l) => !l.archived_at && PROSPECTING_STAGES.includes(normalizeStage(l.stage)))
  const cities = useMemo(() => [...new Set(prospecting.map((l) => l.city).filter(Boolean) as string[])].sort(), [prospecting])
  const rows = prospecting.filter((l) => (city === ALL || l.city === city) && (status === ALL || (status === NONE ? !l.prospect_status : l.prospect_status === status)))

  async function changeStatus(lead: Lead, next: string) {
    const value = next === NONE ? null : next
    // "Qualificado" tira o lead da prospecção e o leva para a etapa Qualificado do pipeline.
    const patch: Record<string, unknown> = { prospect_status: value, ...(value === "qualificado" ? { stage: "qualificado" } : {}) }
    onChange({ ...lead, ...patch } as Lead)
    try {
      onChange({ ...lead, ...(await patchLead(lead.id, patch)) })
      if (value === "qualificado") notify.success("Lead qualificado", `${lead.company_name} seguiu para o pipeline`)
    } catch (err) {
      onChange(lead)
      notify.error("Não foi possível atualizar o status", err instanceof Error ? err.message : undefined)
    }
  }

  const columns: DataTableColumn<Lead>[] = [
    { id: "empresa", header: "Empresa", value: (l) => l.company_name, cell: (l) => (
      <div className="flex min-w-0 max-w-[260px] items-center gap-3">
        <LeadAvatar lead={l} size="sm" />
        <div className="min-w-0"><p className="truncate font-medium text-foreground">{l.company_name}</p><p className="truncate text-xs text-subtle">{l.contact_name || l.whatsapp || l.phone || "—"}</p></div>
      </div>
    ) },
    { id: "cidade", header: "Cidade", value: (l) => l.city ?? "", cell: (l) => <span className="text-zinc-300">{l.city || "—"}</span> },
    { id: "segmento", header: "Segmento", value: (l) => l.segment ?? "", cell: (l) => <span className="text-zinc-300">{l.segment || "—"}</span> },
    { id: "origem", header: "Origem", value: (l) => l.source ?? "", cell: (l) => <span className="text-zinc-300">{l.source || "—"}</span> },
    { id: "responsavel", header: "Responsável", value: (l) => ownerName(l) ?? "", cell: (l) => <span className={ownerName(l) ? "text-zinc-300" : "text-subtle"}>{ownerName(l) ?? "—"}</span> },
    { id: "status", header: "Status de contato", value: (l) => l.prospect_status ?? "", cell: (l) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Select value={l.prospect_status ?? NONE} onValueChange={(v) => changeStatus(l, v)}>
          <SelectTrigger size="sm" className="h-8 w-[170px]" aria-label={`Status de contato de ${l.company_name}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Não iniciado</SelectItem>
            {PROSPECT_STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}><span className={cn("inline-block size-2 shrink-0 rounded-full", dotTone[s.tone])} />{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) },
    { id: "followup", header: "Follow-up", value: (l) => l.next_action_at ?? "", cell: (l) => l.next_action_at
      ? <span className={cn("tabular-nums", isOverdueDate(l.next_action_at) ? "text-red-400" : "text-zinc-300")}>{new Date(`${l.next_action_at.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</span>
      : <span className="text-subtle">—</span> },
    { id: "ultimo", header: "Último contato", value: (l) => l.last_activity_at ?? "", cell: (l) => <span className="text-subtle">{l.last_activity_at ? relativeTime(l.last_activity_at) : "—"}</span> },
  ]

  const counts = PROSPECT_STATUSES.map((s) => ({ ...s, n: prospecting.filter((l) => l.prospect_status === s.id).length }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-white/[0.04] p-1" role="tablist" aria-label="Visão da prospecção">
          {[{ id: "fila", label: "Em abordagem", icon: List }, { id: "mapa", label: "Mapa CNAE", icon: MapPinned }].map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id as "fila" | "mapa")}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors", view === v.id ? "bg-white/[0.08] text-foreground [&_svg]:text-primary" : "text-muted-foreground hover:text-foreground")}>
              <v.icon className="size-4" />{v.label}
            </button>
          ))}
        </div>
        {view === "fila" && (
          <div className="flex flex-wrap gap-2 text-xs">
            {counts.map((c) => (
              <button key={c.id} type="button" onClick={() => setStatus(status === c.id ? ALL : c.id)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors", status === c.id ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground")}>
                <span className={cn("size-1.5 rounded-full", dotTone[c.tone])} />{c.label}<span className="tabular-nums text-subtle">{c.n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "mapa" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Empresas de Santa Catarina por CNAE. Envie para o pipeline e elas entram aqui como “Novo lead”.</p>
          <ProspectMap />
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(l) => l.id}
          loading={loading}
          searchText={(l) => `${l.company_name} ${l.contact_name ?? ""} ${l.city ?? ""} ${l.cnpj ?? ""}`}
          searchPlaceholder="Buscar empresa, contato, cidade..."
          onRowClick={(l) => router.push(`/leads/${l.id}`)}
          pageSize={12}
          toolbar={<>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-10 w-[170px]" aria-label="Filtrar por cidade"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Todas as cidades</SelectItem>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 w-[190px]" aria-label="Filtrar por status de contato"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Todos os status</SelectItem><SelectItem value={NONE}>Não iniciado</SelectItem>{PROSPECT_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </>}
          empty={{ title: "Nenhum lead em abordagem inicial", description: "Leads em “Novo lead” ou “Contato realizado” aparecem aqui. Use o mapa CNAE para encontrar empresas." }}
        />
      )}
    </div>
  )
}
