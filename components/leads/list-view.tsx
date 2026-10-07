"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Pencil } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { relativeTime } from "@/components/core/api-types"
import { DataTable, type DataTableColumn } from "@/components/core/data-table"
import { LeadAvatar, StageBadge } from "@/components/leads/shared"
import { brl } from "@/lib/it-service-data"
import { normalizeStage, PIPELINE_STAGES, type Lead } from "@/lib/pipeline"

const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—")

export function ListView({ leads, loading, ownerName, onEdit, onArchive, emptyAction }: {
  leads: Lead[]; loading: boolean; ownerName: (l: Lead) => string | null
  onEdit: (l: Lead) => void; onArchive: (l: Lead, archived: boolean) => void; emptyAction: React.ReactNode
}) {
  const router = useRouter()
  const [showArchived, setShowArchived] = useState(false)
  const rows = leads.filter((l) => (showArchived ? Boolean(l.archived_at) : !l.archived_at))

  const columns: DataTableColumn<Lead>[] = [
    { id: "empresa", header: "Empresa", value: (l) => l.company_name, cell: (l) => (
      <div className="flex min-w-0 max-w-[260px] items-center gap-3">
        <LeadAvatar lead={l} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{l.company_name}</p>
          <p className="truncate text-xs text-subtle">{[l.segment, l.city].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      </div>
    ) },
    { id: "contato", header: "Contato", value: (l) => l.contact_name ?? "", cell: (l) => <span className="text-zinc-300">{l.contact_name || "—"}</span> },
    { id: "telefone", header: "Telefone", value: (l) => l.whatsapp || l.phone || "", cell: (l) => <span className="tabular-nums text-zinc-300">{l.whatsapp || l.phone || "—"}</span> },
    { id: "responsavel", header: "Responsável", value: (l) => ownerName(l) ?? "", cell: (l) => <span className={ownerName(l) ? "text-zinc-300" : "text-subtle"}>{ownerName(l) ?? "—"}</span> },
    { id: "origem", header: "Origem", value: (l) => l.source ?? "", cell: (l) => <span className="text-zinc-300">{l.source || "—"}</span> },
    { id: "status", header: "Status", value: (l) => PIPELINE_STAGES.findIndex((s) => s.id === normalizeStage(l.stage)), cell: (l) => <StageBadge stage={l.stage} /> },
    { id: "valor", header: "Valor", align: "right", value: (l) => Number(l.estimated_value ?? 0), cell: (l) => <span className="font-medium text-foreground">{brl(Number(l.estimated_value ?? 0))}</span> },
    { id: "ultima", header: "Última atividade", value: (l) => l.last_activity_at ?? "", cell: (l) => <span className="text-subtle">{l.last_activity_at ? relativeTime(l.last_activity_at) : "—"}</span> },
    { id: "proxima", header: "Próxima ação", value: (l) => l.next_action_at ?? "", cell: (l) => l.next_action || l.next_action_at ? (
      <div className="max-w-[200px]"><p className="truncate text-zinc-300">{l.next_action || "Ação agendada"}</p><p className="text-xs text-subtle">{fmtDate(l.next_action_at)}</p></div>
    ) : <span className="text-subtle">—</span> },
  ]

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(l) => l.id}
      loading={loading}
      searchText={(l) => `${l.company_name} ${l.contact_name ?? ""} ${l.cnpj ?? ""} ${l.email ?? ""} ${l.phone ?? ""} ${l.whatsapp ?? ""} ${l.city ?? ""}`}
      searchPlaceholder="Buscar empresa, contato, telefone..."
      onRowClick={(l) => router.push(`/leads/${l.id}`)}
      exportFileName="leads"
      pageSize={12}
      toolbar={
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Mostrar arquivados" />
          Arquivados
        </label>
      }
      rowActions={(l) => (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Ações de ${l.company_name}`} className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => router.push(`/leads/${l.id}`)}><ExternalLink /> Abrir</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(l)}><Pencil /> Editar</DropdownMenuItem>
            <DropdownMenuSeparator />
            {l.archived_at
              ? <DropdownMenuItem onSelect={() => onArchive(l, false)}><ArchiveRestore /> Restaurar</DropdownMenuItem>
              : <DropdownMenuItem onSelect={() => onArchive(l, true)}><Archive /> Arquivar</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      empty={showArchived ? { title: "Nenhum lead arquivado" } : { title: "Nenhum lead cadastrado ainda", description: "Cadastre o primeiro lead, importe uma planilha ou use a prospecção.", action: emptyAction }}
    />
  )
}
