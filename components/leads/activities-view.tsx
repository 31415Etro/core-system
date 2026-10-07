"use client"

import { useState } from "react"
import { Activity } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardHeader, GlassCard } from "@/components/core/glass-card"
import { ErrorState } from "@/components/core/states"
import { Timeline } from "@/components/leads/timeline"
import { activityMeta } from "@/components/leads/utils"
import type { LeadActivity } from "@/lib/pipeline"
import { useApi } from "@/lib/use-api"

const ALL = "all"

/** Feed global de atividades comerciais de todos os leads. */
export function ActivitiesView() {
  const { data, loading, error, reload } = useApi<{ activities: LeadActivity[] }>("/api/lead-activities")
  const [kind, setKind] = useState(ALL)
  const items = (data?.activities ?? []).filter((a) => kind === ALL || a.kind === kind)

  return (
    <GlassCard className="space-y-4">
      <CardHeader
        icon={Activity}
        title="Atividades comerciais"
        description="Ligações, mensagens, mudanças de etapa e vendas de todos os leads"
        actions={
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {Object.entries(activityMeta).map(([id, m]) => <SelectItem key={id} value={id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {error ? <ErrorState message="Não foi possível carregar as atividades." onRetry={reload} /> : <Timeline items={items} loading={loading} empty="Nenhuma atividade registrada ainda" showLead />}
    </GlassCard>
  )
}
